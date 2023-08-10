import config from "config"

export default [
  {
    title: "optavia",
    logoUrl: "https://alfie-signup-partners.s3.amazonaws.com/optavia-logo.png",
    flowType: "SingleStep",
    priceId: config.get("stripe.partnerPriceId"),
  },
  {
    title: "James-River-Cardiology",
    logoUrl:
      "https://alfie-signup-partners.s3.amazonaws.com/JRC_Logo_Final.png",
    flowType: "SingleStep",
  },
]
