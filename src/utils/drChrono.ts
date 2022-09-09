// import axios from 'axios'
// import qs from 'qs'
// const drChronoInstance = axios.create({
//     baseURL: "https://drchrono.com",
//     headers: {
//         "content-type": "application/x-www-form-urlencoded",
//     },
// })

// // const session = await axios.post(
// //     `${process.env.REACT_APP_STRIPE_URL}/billing_portal/sessions`,
// //     qs.stringify({
// //         customer: String(user?.stripeCustomerId),
// //         return_url:
// //             "http://develop.platform.joinalfie.com.s3-website-us-east-1.amazonaws.com/billing",
// //     }),
// //     {
// //         headers: {
// //             "Authorization": `Bearer ${process.env.REACT_APP_STRIPE_SECRET_KEY}`,
// //             "content-type": "application/x-www-form-urlencoded",
// //         },
// //     }
// // )

// function generateApiToken() {
//     try {
//         const token = drChronoInstance.get('/a/token/', qs.stringify(
//             {
//                 client_id: "wnFZiRU6GKuxh2QxVKFD4CRHJe67i8tbx9vthQPe",
//                 redirect_uri: "http://localhost:3000",
//             }))
//     } catch (e) {
//         throw new Error(e)
//     }
// }
