import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('NOVA_SECRET_KEY', '')
if not SECRET_KEY:
    raise RuntimeError('NOVA_SECRET_KEY must be configured; do not use a shared development secret.')
DEBUG = os.environ.get('NOVA_DEBUG', '0') == '1'
ALLOWED_HOSTS = [x.strip() for x in os.environ.get('NOVA_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if x.strip()]
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'rest_framework', 'rest_framework.authtoken', 'ai']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'ai.middleware.ExtensionCorsMiddleware', 'django.middleware.common.CommonMiddleware']
ROOT_URLCONF = 'nova.urls'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('NOVA_DB_PATH', str(BASE_DIR / 'db.sqlite3')), 'OPTIONS': {'timeout': 20}}}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'UTC'
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.TokenAuthentication'], 'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'], 'UNAUTHENTICATED_USER': None}
DATA_UPLOAD_MAX_MEMORY_SIZE = 128 * 1024
NOVA_ALLOWED_ORIGINS = [x.strip() for x in os.environ.get('NOVA_ALLOWED_ORIGINS', '').split(',') if x.strip()]
NOVA_DAILY_LIMIT = max(1, min(10000, int(os.environ.get('NOVA_DAILY_LIMIT', '30'))))
NOVA_PROVIDER = os.environ.get('NOVA_PROVIDER', 'openai')
NOVA_PROVIDER_KEY = os.environ.get('NOVA_PROVIDER_KEY', '')
NOVA_PROVIDER_MODEL = os.environ.get('NOVA_PROVIDER_MODEL', 'gpt-4o-mini')
