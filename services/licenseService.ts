
export const licenseService = {
  /**
   * Verifica se l'utente è Pro interrogando il server.
   * Utilizza il localStorage come cache per le prestazioni.
   */
  isUserPro: async (): Promise<boolean> => {
    const savedEmail = localStorage.getItem('vocal-synth-user-email');
    const localStatus = localStorage.getItem('vocal-synth-pro') === 'active';
    
    // Se è già attivo localmente, diamo fiducia per l'offline
    if (localStatus) return true;
    
    if (savedEmail) {
      try {
        const res = await fetch(`/api/verify?email=${encodeURIComponent(savedEmail)}`);
        const data = await res.json();
        if (data.isPro) {
          localStorage.setItem('vocal-synth-pro', 'active');
          return true;
        }
      } catch (e) {
        console.error("Errore verifica licenza remota:", e);
      }
    }
    
    return false;
  },

  /**
   * Avvia la verifica manuale tramite email.
   */
  verifyEmail: async (email: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/verify?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.isPro) {
        localStorage.setItem('vocal-synth-user-email', email);
        localStorage.setItem('vocal-synth-pro', 'active');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  activatePro: (email?: string) => {
    if (email) localStorage.setItem('vocal-synth-user-email', email);
    localStorage.setItem('vocal-synth-pro', 'active');
    window.location.reload();
  },

  redirectToPayment: () => {
    const STRIPE_URL = 'https://buy.stripe.com/3cI4gA03A8LZ2hnb4zfrW00';
    window.location.href = STRIPE_URL;
  }
};
