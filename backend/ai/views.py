import json
from django.conf import settings
from django.db.models import F
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import DailyUsage
from .provider import provider, ProviderUnavailable
from .serializers import ChatSerializer

def usage(user):
    record, _ = DailyUsage.objects.get_or_create(user=user, date=timezone.localdate())
    return record
class UsageView(APIView):
    def get(self, request):
        record = usage(request.user)
        return Response({'date': str(record.date), 'requests': record.requests, 'limit': settings.NOVA_DAILY_LIMIT})
class ChatView(APIView):
    def post(self, request, mode):
        serializer = ChatSerializer(data=request.data)
        if not serializer.is_valid(): return Response({'error': {'code':'invalid_request','message':'Invalid or oversized request.', 'details':serializer.errors}}, status=400)
        data = serializer.validated_data
        if mode != 'chat' and not data.get('context'): return Response({'error': {'code':'context_required','message':'This action requires explicitly shared context.'}}, status=400)
        record = usage(request.user)
        if not DailyUsage.objects.filter(pk=record.pk, requests__lt=settings.NOVA_DAILY_LIMIT).update(requests=F('requests')+1):
            return Response({'error': {'code':'rate_limited','message':'Daily request limit reached.'}}, status=429)
        try:
            engine = provider(); upstream = engine.start(data, mode)
        except ProviderUnavailable as exc: return Response({'error': {'code':'provider_unavailable','message':str(exc)}}, status=503)
        def stream():
            total = 0
            try:
                for part in engine.chunks(upstream):
                    remaining = 12000 - total
                    if remaining <= 0: break
                    text = part[:remaining]; total += len(text)
                    yield 'event: delta\ndata: ' + json.dumps({'text':text}, ensure_ascii=False) + '\n\n'
                if total == 0:
                    yield 'event: error\ndata: {"message":"The AI returned an empty response."}\n\n'
                else:
                    yield 'event: done\ndata: {}\n\n'
            except Exception:
                yield 'event: error\ndata: {"message":"The AI stream was interrupted."}\n\n'
            finally: upstream.close()
        response = StreamingHttpResponse(stream(), content_type='text/event-stream; charset=utf-8')
        response['Cache-Control'] = 'no-store, no-transform'; response['X-Accel-Buffering'] = 'no'
        return response
