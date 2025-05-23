-- Active: 1717654386153@@dpg-cr1uvsbqf0us739jdj5g-a.oregon-postgres.render.com@5432@bdticketease@public
CREATE TABLE IF NOT EXISTS Empresas (
    empresa_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(20)
);

ALTER TABLE Empresas 
ADD COLUMN email VARCHAR(50),
ADD COLUMN password VARCHAR(255)


ALTER TABLE Empresas 
ADD COLUMN habilitado VARCHAR(20) DEFAULT 1


CREATE TABLE IF NOT EXISTS Usuarios (
    usuario_id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    empresa_id INT REFERENCES Empresas(empresa_id)
);

ALTER TABLE Usuarios
ADD COLUMN apellido VARCHAR(50),
ADD COLUMN numero VARCHAR(15),
ADD COLUMN pais VARCHAR(50),
ADD COLUMN provincia VARCHAR(50),
ADD COLUMN domicilio VARCHAR(100),
ADD COLUMN usuario VARCHAR(50) UNIQUE;

ALTER TABLE Usuarios
ALTER COLUMN empresa_id SET DEFAULT 1;


CREATE TABLE EmpresaEmpleadoAsignacion (
  empresa_id INT,
  ultimo_empleado_asignado INT,
  PRIMARY KEY (empresa_id)
);


CREATE TABLE IF NOT EXISTS Roles (
    rol_id SERIAL PRIMARY KEY,
    rol_nombre VARCHAR(50) NOT NULL
);


ALTER TABLE Tickets ADD COLUMN empleado_id INT;

INSERT INTO Roles (rol_nombre) 
VALUES 
('Administrador'),
('Administrador Empresa'),
('Empleado'),
('Cliente');


CREATE TABLE IF NOT EXISTS Tickets (
    ticket_id SERIAL PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(50),
    prioridad VARCHAR(50),
    usuario_id INT REFERENCES Usuarios(usuario_id)
);

CREATE TABLE IF NOT EXISTS TicketxUsuario (
    ticket_id INT REFERENCES Tickets(ticket_id),
    usuario_id INT REFERENCES Usuarios(usuario_id),
    rol_en_ticket VARCHAR(50),
    PRIMARY KEY (ticket_id, usuario_id)
);

ALTER TABLE Tickets
DROP COLUMN usuario_id;

ALTER TABLE HistorialTickets
ADD COLUMN usuario_id INT REFERENCES Usuarios(usuario_id);



CREATE TABLE IF NOT EXISTS UsuarioXRol (
    usuario_id INT REFERENCES Usuarios(usuario_id),
    rol_id INT REFERENCES Roles(rol_id),
    PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE IF NOT EXISTS HistorialTickets (
    historial_id SERIAL PRIMARY KEY,
    ticket_id INT REFERENCES Tickets(ticket_id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ConfiguracionEmpresas (
    empresa_id INT REFERENCES Empresas(empresa_id),
    personalizacion_FAQs TEXT,
    personalizacion_chatbot TEXT,
    PRIMARY KEY (empresa_id)
);



INSERT INTO Usuarios (usuario_id, nombre, email, password, empresa_id, apellido, numero, pais, provincia, domicilio, usuario)
VALUES 
(17, 'Tomas Blanco', 'sd@gmail.com', '1234', 5, NULL, NULL, NULL, NULL, NULL, NULL)


SELECT * FROM Usuarios WHERE empresa_id = 1;



INSERT INTO TicketxUsuario (ticket_id, usuario_id, rol_en_ticket) VALUES (1, 5, 4);