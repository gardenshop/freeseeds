// Disposable rollback proof baseline. No routes, bindings, secrets, or side effects.
export default {
  async fetch() {
    return new Response("A", { status: 200 });
  }
};
