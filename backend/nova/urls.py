from django.urls import path
from ai.views import ChatView, UsageView
urlpatterns = [path('api/ai/chat/', ChatView.as_view(), {'mode': 'chat'}), path('api/ai/summarise/', ChatView.as_view(), {'mode': 'summarise'}), path('api/ai/explain/', ChatView.as_view(), {'mode': 'explain'}), path('api/ai/notes/', ChatView.as_view(), {'mode': 'notes'}), path('api/ai/usage/', UsageView.as_view())]
