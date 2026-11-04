from rest_framework import serializers
class ContextSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300, allow_blank=True)
    url = serializers.URLField(max_length=2048, allow_blank=True)
    text = serializers.CharField(max_length=24000, allow_blank=False, trim_whitespace=True)
    def validate_url(self, value):
        if value:
            from urllib.parse import urlsplit
            parts = urlsplit(value)
            if parts.scheme not in ('http', 'https') or parts.username or parts.password: raise serializers.ValidationError('Only HTTP(S) URLs without credentials are supported.')
        return value
class MessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['user','assistant'])
    content = serializers.CharField(max_length=4000, allow_blank=False)
class ChatSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=4000, allow_blank=False)
    context = ContextSerializer(required=False, allow_null=True)
    history = MessageSerializer(many=True, required=False, max_length=8)
    def validate(self, data):
        if sum(len(m['content']) for m in data.get('history', [])) > 12000: raise serializers.ValidationError('Conversation history exceeds the limit.')
        return data
