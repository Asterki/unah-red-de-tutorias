const auth = {
  login: {
    title: "Iniciar Sesión",
    description: "Elija cómo desea iniciar sesión para continuar.",
    employeeTitle: "Empleado o Estudiante",
    employeeDescription:
      "Use su cuenta institucional de Microsoft para acceder a la plataforma.",
    applicantTitle: "Soy Aspirante",
    applicantDescription:
      "Use su cuenta de Google o Apple para solicitar sesiones de tutoría.",
    microsoft: "Continuar con Microsoft",
    google: "Continuar con Google",
    apple: "Continuar con Apple",
    noProviders:
      "Todavía no hay ningún método de inicio de sesión federado configurado.",
    errorTitle: "No pudimos iniciar su sesión",
    passwordDivider: "o",
    passwordTitle: "Iniciar sesión con correo y contraseña",
    passwordButton: "Usar correo y contraseña",
  },
  password: {
    title: "Iniciar Sesión",
    description: "Ingrese sus credenciales para continuar.",
    fields: {
      email: "Correo Electrónico",
      emailPlaceholder: "Ingrese su correo electrónico",
      password: "Contraseña",
      passwordPlaceholder: "Ingrese su contraseña",
    },
    submit: "Iniciar Sesión",
    back: "Volver a todas las opciones de inicio de sesión",
    messages: {
      success: "Inicio de sesión exitoso.",
    },
  },
  logout: {
    title: "Cerrar Sesión",
    description: "¿Está seguro de que desea cerrar sesión?",
    button: "Cerrar Sesión",
    cancel: "Cancelar",
  },
  changePassword: {
    title: "Cambiar Contraseña",
    description: "Actualice la contraseña de su propia cuenta.",
    forcedTitle: "Cambio de contraseña obligatorio",
    forcedDescription:
      "Debe cambiar la contraseña inicial antes de usar el resto del sistema.",
    fields: {
      currentPassword: "Contraseña actual",
      newPassword: "Nueva contraseña (mínimo 12 caracteres)",
      confirmPassword: "Confirmar nueva contraseña",
    },
    messages: {
      success: "Contraseña actualizada.",
      mismatch: "Las contraseñas no coinciden.",
    },
  },
};

export default auth;
