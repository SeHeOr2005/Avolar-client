/**
 * Sesión del panel atada a la pestaña.
 * - Al iniciar sesión se guarda una marca en sessionStorage, que el navegador borra al cerrar la pestaña
 *   (sobrevive a recargas con F5).
 * - Al abrir la web sin esa marca, se pregunta por BroadcastChannel si hay otra pestaña del panel abierta;
 *   si la hay, la nueva pestaña hereda la sesión. Si no, la sesión se considera cerrada.
 */
const KEY = 'avolar-admin-tab';
const CHANNEL = 'avolar-admin-session';

export const markTab = () => {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* sin almacenamiento */
  }
};

export const clearTab = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignorar */
  }
};

export const isTabMarked = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** ¿Hay otra pestaña con el panel abierto y la sesión activa? Espera la respuesta como mucho `ms`. */
export function otherTabHasSession(ms = 400): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const ch = new BroadcastChannel(CHANNEL);
    const done = (v: boolean) => {
      clearTimeout(timer);
      ch.close();
      resolve(v);
    };
    const timer = setTimeout(() => done(false), ms);
    ch.onmessage = (e) => e.data === 'pong' && done(true);
    ch.postMessage('ping');
  });
}

/** Responde a otras pestañas mientras esta tenga la sesión. Devuelve la función para dejar de escuchar. */
export function answerOtherTabs(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e) => {
    if (e.data === 'ping' && isTabMarked()) ch.postMessage('pong');
  };
  return () => ch.close();
}
