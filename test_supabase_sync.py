#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de teste para sincronização com Supabase
Testa a rota /api/sync/supabase sem dependências externas
"""

import json
import socket
from urllib import error as urlerror
from urllib import request as urlrequest
from datetime import datetime

BASE_URL = "http://127.0.0.1:5000"

# Credenciais de admin
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


def post_json(url, payload, headers, timeout=30):
    body = json.dumps(payload).encode("utf-8")
    request = urlrequest.Request(url, data=body, headers=headers, method="POST")
    try:
        with urlrequest.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw or "{}")
    except urlerror.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            payload = {"success": False, "error": raw or str(exc)}
        return exc.code, payload


def test_sync():
    """Testa a sincronização com Supabase"""
    
    print("=" * 60)
    print("🧪 TESTE DE SINCRONIZAÇÃO COM SUPABASE")
    print("=" * 60)
    
    # Dados de teste
    test_data = {
        "professionals": [
            {
                "id": 1,
                "name": "Dr. João Silva",
                "specialty": "Psicologia"
            },
            {
                "id": 2,
                "name": "Dra. Maria Santos",
                "specialty": "Neuropsicologia"
            }
        ],
        "appointments": [
            {
                "id": 1,
                "professional": "Dr. João Silva",
                "patient": "João da Silva",
                "service_type": "Atendimento Clínica",
                "date": "2026-01-28",
                "start_time": "14:00",
                "end_time": "15:00"
            }
        ],
        "users": {
            "admin": {
                "name": "Administrador Principal",
                "password": "admin123",
                "level": "admin"
            },
            "editor1": {
                "name": "Editor Teste",
                "password": "editor123",
                "level": "editor"
            }
        }
    }
    
    print("\n📊 DADOS A SINCRONIZAR:")
    print(f"  👨‍⚕️ Profissionais: {len(test_data['professionals'])}")
    print(f"  📅 Agendamentos: {len(test_data['appointments'])}")
    print(f"  👥 Usuários: {len(test_data['users'])}")
    
    # Preparar headers de autenticação
    auth_header = f"Bearer {ADMIN_USERNAME}:{ADMIN_PASSWORD}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": auth_header
    }
    
    print("\n🔐 AUTENTICAÇÃO:")
    print(f"  Usuário: {ADMIN_USERNAME}")
    print(f"  Nível: admin")
    
    try:
        print("\n⏳ ENVIANDO REQUISIÇÃO...")
        
        status_code, result = post_json(
            f"{BASE_URL}/api/sync/supabase",
            test_data,
            headers=headers,
            timeout=30
        )
        print(f"\n📍 Status: {status_code}")
        
        
        if result.get('success'):
            print("\n✅ SINCRONIZAÇÃO BEM-SUCEDIDA!")
            print("\n📊 RESUMO:")
            summary = result.get('summary', {})
            print(f"  👨‍⚕️ Profissionais sincronizados: {summary.get('professionals_synced', 0)}")
            print(f"  📅 Agendamentos sincronizados: {summary.get('appointments_synced', 0)}")
            print(f"  👥 Usuários sincronizados: {summary.get('users_synced', 0)}")
            print(f"  ⏰ Timestamp: {summary.get('timestamp', 'N/A')}")
            
            print("\n💬 MENSAGEM:")
            print(f"  {result.get('message', 'Sem mensagem')}")
        else:
            print("\n❌ ERRO NA SINCRONIZAÇÃO!")
            print(f"  Erro: {result.get('error', 'Erro desconhecido')}")
            
    except urlerror.URLError:
        print("\n❌ ERRO: Não consegui conectar ao servidor!")
        print(f"  Certifique-se de que o servidor está rodando em {BASE_URL}")
        print("\n💡 Para iniciar o servidor, execute:")
        print("   python app.py")
    except socket.timeout:
        print("\n⏱️ ERRO: Timeout na requisição!")
        print("  O servidor demorou muito para responder.")
    except Exception as e:
        print(f"\n❌ ERRO: {str(e)}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_sync()
