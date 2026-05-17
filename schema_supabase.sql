BEGIN;

CREATE TABLE IF NOT EXISTS profissionais (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    especialidade TEXT,
    telefone VARCHAR(80),
    data_nascimento DATE,
    email VARCHAR(255),
    numero_conselho VARCHAR(120),
    preferencia TEXT,
    contato_emergencia VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS especialidade TEXT;
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS telefone VARCHAR(80);
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS numero_conselho VARCHAR(120);
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS preferencia TEXT;
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS contato_emergencia VARCHAR(255);
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW();
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS pacientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    data_nascimento DATE,
    endereco TEXT,
    telefone VARCHAR(80),
    nome_mae VARCHAR(255),
    nome_pai VARCHAR(255),
    convenio VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS telefone VARCHAR(80);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(255);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS nome_pai VARCHAR(255);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS convenio VARCHAR(255);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW();
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    level VARCHAR(50) DEFAULT 'viewer',
    name VARCHAR(255),
    notes TEXT,
    profissional_id INTEGER,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    ultimo_login_em TIMESTAMP,
    ultimo_login_ip VARCHAR(80),
    ultimo_login_user_agent TEXT,
    must_change_password BOOLEAN DEFAULT FALSE
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS level VARCHAR(50) DEFAULT 'viewer';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS profissional_id INTEGER;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login_em TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login_ip VARCHAR(80);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login_user_agent TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS salas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    cor VARCHAR(20),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE salas ADD COLUMN IF NOT EXISTS cor VARCHAR(20);
ALTER TABLE salas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE salas ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    profissional VARCHAR(255) NOT NULL,
    profissional_id INTEGER,
    paciente VARCHAR(255) NOT NULL,
    paciente_id INTEGER,
    tipo_atendimento VARCHAR(255),
    data DATE NOT NULL,
    hora_inicio VARCHAR(10) NOT NULL,
    hora_fim VARCHAR(10),
    quantidade_sessoes INTEGER,
    sala_id INTEGER,
    criado_por VARCHAR(255),
    status VARCHAR(50) DEFAULT 'agendado',
    ultima_acao VARCHAR(255),
    cancelado_por_username VARCHAR(255),
    recorrencia_grupo_id VARCHAR(80),
    recorrencia_indice INTEGER,
    recorrencia_total INTEGER,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS profissional_id INTEGER;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS paciente_id INTEGER;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS tipo_atendimento VARCHAR(255);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS hora_fim VARCHAR(10);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS quantidade_sessoes INTEGER;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS sala_id INTEGER;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS criado_por VARCHAR(255);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'agendado';
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS ultima_acao VARCHAR(255);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cancelado_por_username VARCHAR(255);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS recorrencia_grupo_id VARCHAR(80);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS recorrencia_indice INTEGER;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS recorrencia_total INTEGER;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW();
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS usuario_preferencias (
    username VARCHAR(255) PRIMARY KEY,
    preferencias JSONB NOT NULL DEFAULT '{}'::jsonb,
    atualizado_por VARCHAR(255),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE usuario_preferencias ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE usuario_preferencias ADD COLUMN IF NOT EXISTS atualizado_por VARCHAR(255);
ALTER TABLE usuario_preferencias ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS sistema_configuracoes (
    chave VARCHAR(120) PRIMARY KEY,
    valor TEXT,
    atualizado_por VARCHAR(255),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE sistema_configuracoes ADD COLUMN IF NOT EXISTS atualizado_por VARCHAR(255);
ALTER TABLE sistema_configuracoes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS remarque_solicitacoes (
    id SERIAL PRIMARY KEY,
    agendamento_id INTEGER NOT NULL,
    profissional_id VARCHAR(255),
    original_data DATE,
    original_hora_inicio VARCHAR(10),
    original_hora_fim VARCHAR(10),
    nova_data DATE NOT NULL,
    nova_hora_inicio VARCHAR(10) NOT NULL,
    nova_hora_fim VARCHAR(10) NOT NULL,
    inverter_horarios BOOLEAN DEFAULT FALSE,
    conflito_agendamento_id INTEGER,
    conflito_nova_data DATE,
    conflito_nova_hora_inicio VARCHAR(10),
    conflito_nova_hora_fim VARCHAR(10),
    conflito_realocacoes JSONB,
    observacao TEXT,
    status VARCHAR(30) DEFAULT 'pendente',
    solicitado_por VARCHAR(255),
    solicitado_por_username VARCHAR(255),
    solicitado_em TIMESTAMP DEFAULT NOW(),
    autorizado_por VARCHAR(255),
    autorizado_em TIMESTAMP,
    rejeitado_por VARCHAR(255),
    rejeitado_em TIMESTAMP,
    motivo_reprovacao TEXT,
    decidido_por_setor VARCHAR(80)
);

ALTER TABLE remarque_solicitacoes ADD COLUMN IF NOT EXISTS conflito_nova_data DATE;
ALTER TABLE remarque_solicitacoes ADD COLUMN IF NOT EXISTS conflito_nova_hora_inicio VARCHAR(10);
ALTER TABLE remarque_solicitacoes ADD COLUMN IF NOT EXISTS conflito_nova_hora_fim VARCHAR(10);
ALTER TABLE remarque_solicitacoes ADD COLUMN IF NOT EXISTS conflito_realocacoes JSONB;
ALTER TABLE remarque_solicitacoes ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT;
ALTER TABLE remarque_solicitacoes ADD COLUMN IF NOT EXISTS decidido_por_setor VARCHAR(80);

CREATE TABLE IF NOT EXISTS agendamento_auditoria (
    id SERIAL PRIMARY KEY,
    agendamento_id INTEGER NOT NULL,
    acao VARCHAR(80) NOT NULL,
    status_anterior VARCHAR(50),
    status_novo VARCHAR(50),
    usuario_nome VARCHAR(255),
    usuario_username VARCHAR(255),
    detalhes TEXT,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lista_espera (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER,
    paciente_nome VARCHAR(255),
    profissional_id INTEGER,
    sala_id INTEGER,
    tipo_atendimento VARCHAR(80),
    prioridade VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(30) DEFAULT 'aguardando',
    preferencia_dias TEXT,
    preferencia_horarios TEXT,
    observacao TEXT,
    criado_por_nome VARCHAR(255),
    criado_por_username VARCHAR(255),
    encaixado_agendamento_id INTEGER,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    encaixado_em TIMESTAMP
);

ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS paciente_id INTEGER;
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS paciente_nome VARCHAR(255);
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS profissional_id INTEGER;
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS sala_id INTEGER;
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS tipo_atendimento VARCHAR(80);
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'normal';
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'aguardando';
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS preferencia_dias TEXT;
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS preferencia_horarios TEXT;
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS criado_por_nome VARCHAR(255);
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS criado_por_username VARCHAR(255);
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS encaixado_agendamento_id INTEGER;
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW();
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS encaixado_em TIMESTAMP;

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    acao VARCHAR(120) NOT NULL,
    entidade_tipo VARCHAR(80) NOT NULL,
    entidade_id VARCHAR(120),
    entidade_rotulo TEXT,
    usuario_nome VARCHAR(255),
    usuario_username VARCHAR(255),
    dados_antes JSONB,
    dados_depois JSONB,
    detalhes JSONB,
    ip VARCHAR(80),
    user_agent TEXT,
    criado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entidade_rotulo TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS dados_antes JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS dados_depois JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS detalhes JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip VARCHAR(80);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

INSERT INTO salas (nome, cor, ativo)
SELECT v.nome, v.cor, TRUE
FROM (
    VALUES
        ('AMARELA', '#fff200'),
        ('AZUL', '#00aeef'),
        ('AZUL BEBE', '#5bc0de'),
        ('AZUL TURQUESA', '#39d5c8'),
        ('BEGE', '#f5f5dc'),
        ('BRANCA', '#ffffff'),
        ('CINZA', '#808080'),
        ('COLORIDA - IS', '#1d1b8f'),
        ('COPA 6º', '#ffffcc'),
        ('COPA 7º', '#ffffcc'),
        ('DOURADA', '#f5d45a'),
        ('LARANJA', '#ffc000'),
        ('LILÁS', '#d9c2f0'),
        ('MARROM', '#8b5a2b'),
        ('NEON', '#ff7f27'),
        ('PRATEADA', '#c0c0c0'),
        ('PRETA', '#000000'),
        ('ROSA', '#ff99ff'),
        ('ROSA PINK', '#ff5bc8'),
        ('ROSÉ', '#f7d8c8'),
        ('ROXA', '#a259d9'),
        ('SALA DE BRINQUEDOS', '#8aa100'),
        ('SALA DE DISCUSSÃO', '#ffffff'),
        ('Sala de Reunião', '#5b5b5b'),
        ('Sala Demo 1', '#ffffff'),
        ('Sala do 3ºandar', '#ffffff'),
        ('SALA ONLINE 6º andar', '#ffffff'),
        ('Sala Online Neuro', '#ffffff'),
        ('Sala Online PsicoPM MT', '#ffffff'),
        ('Sala Online Reunião', '#808080'),
        ('Sala Reunião ABA', '#808080'),
        ('Sala Reunião Fono', '#808080'),
        ('Sala Reunião MT e PM', '#808080'),
        ('Sala Reunião Neuro', '#808080'),
        ('Sala Sup T.O', '#555555'),
        ('Sala Supervisão Online', '#808080'),
        ('VERDE', '#30d830'),
        ('VERDE ÁGUA', '#00ffd5'),
        ('VERDE LIMÃO', '#55ff33'),
        ('VERMELHA', '#ff1a1a'),
        ('VINHO', '#c00000')
) AS v(nome, cor)
WHERE NOT EXISTS (
    SELECT 1 FROM salas s WHERE lower(s.nome) = lower(v.nome)
);

UPDATE salas
SET ativo = FALSE
WHERE lower(nome) IN (
    lower('SALA DE CONVENÇÕES 17'),
    lower('SALA DE CONVENCOES 17'),
    lower('SALA DE CONVENCAO'),
    lower('SALA DE CONVENÇÃO')
);

INSERT INTO usuarios (
    username, password, level, name, notes, created_by, created_at, is_active, must_change_password
)
SELECT
    'admin',
    'scrypt:32768:8:1$JhLdV578y6peAZlw$e866be773261a165e02b44770019b4e1bd8a3660f01156934b7a0ffbdf598db6e19529b74986d616fd2f1f765a2bbcf60c0d5f20a5ae842503979df85fd2874c',
    'admin',
    'Administrador',
    'Usuario admin padrao',
    'schema_supabase.sql',
    NOW(),
    TRUE,
    FALSE
WHERE NOT EXISTS (
    SELECT 1 FROM usuarios WHERE lower(username) = 'admin'
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username_lower ON usuarios (lower(username));
CREATE INDEX IF NOT EXISTS idx_profissionais_nome_lower ON profissionais (lower(nome));
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_criado_em ON agendamentos (data, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_agendamentos_prof_data_hora ON agendamentos (profissional, data, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional_id_data_hora ON agendamentos (profissional_id, data, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente_id_data_hora ON agendamentos (paciente_id, data, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_sala_data_hora ON agendamentos (sala_id, data, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_criado_em ON agendamentos (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_agendamentos_recorrencia_grupo ON agendamentos (recorrencia_grupo_id);
CREATE INDEX IF NOT EXISTS idx_salas_nome_lower ON salas (lower(nome));
CREATE INDEX IF NOT EXISTS idx_salas_ativo_nome ON salas (ativo, nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_preferencias_username ON usuario_preferencias (username);
CREATE INDEX IF NOT EXISTS idx_remarque_agendamento_status ON remarque_solicitacoes (agendamento_id, status);
CREATE INDEX IF NOT EXISTS idx_remarque_solicitante_status ON remarque_solicitacoes (solicitado_por_username, status);
CREATE INDEX IF NOT EXISTS idx_remarque_status_solicitado_em ON remarque_solicitacoes (status, solicitado_em DESC);
CREATE INDEX IF NOT EXISTS idx_remarque_agendamento_status_autorizado ON remarque_solicitacoes (agendamento_id, status, autorizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_agendamento_auditoria_agendamento_em ON agendamento_auditoria (agendamento_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_criado_em ON audit_logs (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade ON audit_logs (entidade_tipo, entidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario ON audit_logs (usuario_username, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acao ON audit_logs (acao, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_lista_espera_status_prioridade ON lista_espera (status, prioridade, criado_em);
CREATE INDEX IF NOT EXISTS idx_lista_espera_paciente ON lista_espera (paciente_id);

COMMIT;
