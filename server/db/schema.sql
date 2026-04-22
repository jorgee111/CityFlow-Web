-- =============================================
-- CityFlow Web - Azure SQL Database Schema
-- Compatible con Azure SQL Database (SQL Server)
-- =============================================

-- ─── TABLA PRINCIPAL DE USUARIOS ────────────────────────
CREATE TABLE users (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  email         NVARCHAR(255) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  display_name  NVARCHAR(100) NOT NULL,
  role          NVARCHAR(20)  NOT NULL DEFAULT 'pasajero'
                CHECK (role IN ('pasajero', 'conductor', 'gestor')),
  phone         NVARCHAR(20)  NULL,
  avatar_url    NVARCHAR(500) NULL,
  assigned_line NVARCHAR(20)  NULL,
  last_login    DATETIME2     NULL,
  created_at    DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at    DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ─── AUTOBUSES (datos en tiempo real) ────────────────────
CREATE TABLE buses (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  bus_code        NVARCHAR(20)  NOT NULL UNIQUE,
  line            NVARCHAR(10)  NOT NULL,
  destination     NVARCHAR(100) NOT NULL,
  lat             FLOAT         NOT NULL,
  lng             FLOAT         NOT NULL,
  occupancy_pct   INT           NOT NULL DEFAULT 0 CHECK (occupancy_pct BETWEEN 0 AND 100),
  occupancy_level NVARCHAR(10)  NOT NULL DEFAULT 'low'
                  CHECK (occupancy_level IN ('low', 'medium', 'high')),
  speed_kmh       INT           NOT NULL DEFAULT 0,
  eta_minutes     INT           NOT NULL DEFAULT 5,
  line_color      NVARCHAR(10)  NOT NULL DEFAULT '#3b9ed4',
  is_active       BIT           NOT NULL DEFAULT 1,
  last_updated    DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ─── INCIDENCIAS ─────────────────────────────────────────
CREATE TABLE incidents (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  user_id     INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        NVARCHAR(20)  NOT NULL CHECK (type IN ('normal', 'urgencia', 'refuerzo')),
  title       NVARCHAR(200) NOT NULL,
  description NVARCHAR(MAX) NULL,
  line        NVARCHAR(10)  NULL,
  status      NVARCHAR(20)  NOT NULL DEFAULT 'abierta'
              CHECK (status IN ('abierta', 'en_proceso', 'resuelta')),
  created_at  DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at  DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ─── SUGERENCIAS/MENSAJES ─────────────────────────────────
CREATE TABLE suggestions (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  user_id    INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    NVARCHAR(MAX) NOT NULL,
  response   NVARCHAR(MAX) NULL,
  created_at DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ─── ÍNDICES DE RENDIMIENTO ────────────────────────────────
CREATE INDEX IX_incidents_user_id ON incidents(user_id);
CREATE INDEX IX_incidents_status  ON incidents(status);
CREATE INDEX IX_buses_is_active   ON buses(is_active);
CREATE INDEX IX_buses_line        ON buses(line);
CREATE INDEX IX_suggestions_user  ON suggestions(user_id);

-- =============================================
-- DATOS DEMO (seed data)
-- =============================================

-- Usuario gestor admin (password: Admin1234!)
INSERT INTO users (email, password_hash, display_name, role, assigned_line)
VALUES ('admin@cityflow.es',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LkCDOW13Jqy', -- Admin1234!
        'Admin CityFlow', 'gestor', NULL);

-- Conductor demo (password: Conductor1!)
INSERT INTO users (email, password_hash, display_name, role, assigned_line)
VALUES ('carlos@cityflow.es',
        '$2a$10$7E2G0qPHd.Iw/J7bKjwpS.BV5bTJqA9CbHCmkpVUlDgWD6nIxBvq6', -- Conductor1!
        'Carlos López', 'conductor', '27');

-- Pasajero demo (password: Pasajero1!)
INSERT INTO users (email, password_hash, display_name, role, assigned_line)
VALUES ('ana@ejemplo.es',
        '$2a$10$kJsoV2w3V3bJsrRuF2jWne.tECaKY.U5PkCZqc4WNjwJN45bJU65O', -- Pasajero1!
        'Ana García', 'pasajero', NULL);

-- Autobuses demo en Madrid
INSERT INTO buses (bus_code, line, destination, lat, lng, occupancy_pct, occupancy_level, speed_kmh, eta_minutes, line_color, is_active) VALUES
('BUS-27-001', '27',  'Plaza Castilla',  40.4200, -3.7000, 30,  'low',    35, 3,  '#e8a838', 1),
('BUS-27-002', '27',  'Plaza Castilla',  40.4150, -3.7020, 62,  'medium', 28, 8,  '#e8a838', 1),
('BUS-65-001', '65',  'Moncloa',         40.4320, -3.7190, 65,  'medium', 40, 7,  '#3b9ed4', 1),
('BUS-82-001', '82',  'Atocha',          40.4060, -3.6890, 91,  'high',   22, 2,  '#e05252', 1),
('BUS-82-002', '82',  'Pirámides',       40.4080, -3.7100, 78,  'high',   30, 5,  '#e05252', 1),
('BUS-44-001', '44',  'Chamartín',       40.4500, -3.6920, 18,  'low',    45, 12, '#4ade80', 1),
('BUS-132-001','132', 'Las Tablas',      40.4680, -3.7050, 55,  'medium', 38, 5,  '#a78bfa', 1),
('BUS-N1-001', 'N1',  'Las Tablas',      40.4170, -3.7040, 12,  'low',    50, 15, '#94a3b8', 1),
('BUS-1-001',  '1',   'Sol',             40.4160, -3.7036, 88,  'high',   20, 4,  '#f97316', 1),
('BUS-74-001', '74',  'Canillejas',      40.4190, -3.6800, 50,  'medium', 33, 9,  '#14b8a6', 1);

-- Incidencias demo
INSERT INTO incidents (user_id, type, title, description, line, status, created_at, updated_at) VALUES
(2, 'normal',   'Retraso en parada Atocha',   'Acumulación de pasajeros tras cancelación anterior.', '27', 'abierta',    DATEADD(hour,-1,GETDATE()), DATEADD(hour,-1,GETDATE())),
(2, 'urgencia', 'Avería en motor',             'El autobús ha quedado inmovilizado en Goya.',          '27', 'en_proceso', DATEADD(hour,-3,GETDATE()), DATEADD(hour,-2,GETDATE())),
(2, 'refuerzo', 'Necesito refuerzo en Retiro', 'Alta ocupación, se necesita autobús adicional.',       '27', 'resuelta',   DATEADD(hour,-5,GETDATE()), DATEADD(hour,-4,GETDATE()));

-- Sugerencias demo
INSERT INTO suggestions (user_id, message, response, created_at) VALUES
(3, 'La app funciona muy bien, sería genial ver el tiempo de espera en tiempo real.', 
   'Gracias por tu sugerencia, estamos trabajando en ello.', DATEADD(hour,-2,GETDATE())),
(3, 'Echaría de menos poder ver el historial de mis trayectos.', NULL, DATEADD(hour,-6,GETDATE()));
