import { Resolver, Query, Arg } from "type-graphql"
import {
  GooglePlacesSearchInput,
  GooglePlacesSearchResult,
  GoogleReverseGeoCodeInput,
  GoogleReverseGeoCodeResult,
} from "../schema/googlePlaces.schema"
import axios from "axios"

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
export async function getReverseGeoCodeFromGoogle(
  city: string,
  state: string,
  line1: string,
  postalCode: string
) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${line1},${city},${state},${postalCode}&key=${process.env.GOOGLE_API_KEY}`

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
  async reverseGeoCode(
    @Arg("input") { city, state, line1, postalCode }: GoogleReverseGeoCodeInput
  ) {
    return await getReverseGeoCodeFromGoogle(city, state, line1, postalCode)
  }
}
