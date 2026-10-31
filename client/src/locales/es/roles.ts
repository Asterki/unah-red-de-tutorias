const roles = {
  title: "Roles y Permisos",
  description:
    "Los roles y permisos están definidos en el código. Esta vista es de solo lectura.",
  table: {
    role: "Rol",
    permissions: "Permisos",
  },
  names: {
    tech_admin: "Administrador de Tecnología",
    general_admin: "Administrador General",
    campus_admin: "Administrador de Campus",
    tutor: "Tutor",
    student: "Estudiante",
    external: "Aspirante",
    observer: "Observador",
  },
  permissions: {
    accounts: {
      read: "Leer cuentas",
      create: "Crear cuentas",
      update: "Actualizar cuentas",
      "update-status": "Actualizar estado de cuentas",
      "change-password": "Cambiar contraseñas",
      delete: "Eliminar cuentas",
      restore: "Restaurar cuentas",
    },
    roles: {
      read: "Leer roles",
    },
    docs: {
      read: "Leer documentación",
    },
  },
};

export default roles;
