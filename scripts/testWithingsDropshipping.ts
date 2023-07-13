import runShell from "./utils/runShell"
import UserService from "../src/services/user.service"
import WithingsService, { TEST_MODE } from "../src/services/withings.service"

async function testWithingsDropshipping() {
  const userService = new UserService()
  const withingsService = new WithingsService()

  const user = await userService.getUser("648c9a95c0293d72a4e5e7dd")
  const withingsAddress = {
    name: user.name,
    company_name: "Alfie",
    email: user.email,
    telephone: user.phone,
    address1: user.address.line1,
    address2: user.address.line2,
    city: user.address.city,
    zip: user.address.postalCode,
    state: user.address.state,
    country: "US",
  }

  // Shipped
  const order = await withingsService.createOrder(
    user.id,
    withingsAddress,
    TEST_MODE.SHIPPED
  )
  console.log(order)
}

runShell(() => testWithingsDropshipping())
