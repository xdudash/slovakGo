const DEMO_PENDING_KEY = "slovakgo.demo-pending";

export const demoService = {
  markPending(): void {
    sessionStorage.setItem(DEMO_PENDING_KEY, "1");
  },

  complete(): void {
    sessionStorage.removeItem(DEMO_PENDING_KEY);
  },

  isPending(): boolean {
    return sessionStorage.getItem(DEMO_PENDING_KEY) === "1";
  },
};
