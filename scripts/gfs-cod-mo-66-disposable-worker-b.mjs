// Disposable rollback proof candidate. No routes, bindings, secrets, or side effects.
export default {
  async fetch() {
    return new Response("B", { status: 200 });
  }
};
