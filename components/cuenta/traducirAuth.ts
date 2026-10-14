/** Los errores de Supabase Auth llegan en inglés; los habituales, en cristiano. */
export function traducirAuth(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Aún no has confirmado tu email. Entra con un código.";
  if (/rate limit|security purposes|too many/i.test(msg)) return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  if (/password should be at least/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/same.*password|different from the old/i.test(msg)) return "La nueva contraseña tiene que ser distinta de la anterior.";
  if (/signups not allowed/i.test(msg)) return "Ahora mismo no se pueden crear cuentas nuevas.";
  if (/already (been )?registered|email_exists|already in use/i.test(msg)) return "Ese email ya lo usa otra cuenta.";
  if (/unable to validate email|invalid.*email|email.*invalid/i.test(msg)) return "Ese email no parece válido. Revísalo.";
  if (/reauthentication|requires recent login/i.test(msg)) return "Por seguridad, sal y vuelve a entrar antes de cambiar esto.";
  return msg;
}

/** ¿El error de signInWithOtp dice que la cuenta no existe? (con shouldCreateUser: false) */
export function esCuentaInexistente(msg: string): boolean {
  return /signups not allowed|user not found|otp_disabled/i.test(msg);
}
