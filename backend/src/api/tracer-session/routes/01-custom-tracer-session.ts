export default {
  routes: [
    {
      method: "POST",
      path: "/tracer-sessions/submit",
      handler: "tracer-session.submit",
      config: {
        policies: [],
      },
    },
  ],
};
