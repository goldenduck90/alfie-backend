import { Resolver, Query, Arg, Ctx } from "type-graphql"
import {
  GooglePlacesSearchInput,
  GooglePlacesSearchResult,
  GoogleReverseGeoCodeResult,
} from "../schema/googlePlaces.schema"
import axios from "axios"
import Context from "../types/context"
import { UserModel } from "../schema/user.schema"
import { ApolloError } from "apollo-server"

export async function getLocationsFromGoogleAutoComplete(
  query: string,
  location: string,
  radius: number,
  type: string
) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&location=${location}&radius=${radius}&types=${type}&key=${process.env.GOOGLE_API_KEY}`
    const response = await axios.get(url)
    return response.data.predictions
  } catch (error) {
    console.log(error)
  }
}
export async function getReverseGeoCodeFromGoogle(userId: string) {
  try {
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApolloError("User not found", "NOT_FOUND")
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${user.address.line1},${user.address.city},${user.address.state},${user.address.postalCode}&key=${process.env.GOOGLE_API_KEY}`

    const response = await axios.get(url)
    return response.data.results
  } catch (error) {
    console.log(error)
  }
}
@Resolver()
export default class GooglePlacesResolver {
  @Query(() => [GooglePlacesSearchResult])
  async places(
    @Arg("input") { location, radius, type, query }: GooglePlacesSearchInput
  ) {
    return await getLocationsFromGoogleAutoComplete(
      query,
      location,
      radius,
      type
    )
  }
  @Query(() => [GoogleReverseGeoCodeResult])
  async reverseGeoCode(@Ctx() context: Context) {
    return await getReverseGeoCodeFromGoogle(context.user._id)
  }
}
