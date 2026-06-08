export default {
  routes: [
    {
      method: "GET",
      path: "/reports/years",
      handler: "report.years",
      config: { policies: [] },
    },
    {
      method: "GET",
      path: "/reports/summary",
      handler: "report.summary",
      config: { policies: [] },
    },
  ],
};
