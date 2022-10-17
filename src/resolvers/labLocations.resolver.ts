import { Resolver, Query, Arg } from "type-graphql"
import {
  GooglePlacesSearchInput,
  GooglePlacesSearchResult,
} from "../schema/googlePlaces.schema"
import axios from "axios"

export async function getLocationsFromGoogleAutoComplete(
  query: string,
  location: string,
  radius: number,
  type: string
) {
  try {
    // const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&location=${location}&radius=${radius}&types=${type}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?latlng=lat,lng&key=YOUR_API_KEY"
    const response = await axios.get(url)
    return response.data.predictions
  } catch (error) {
    console.log(error)
  }
}
@Resolver()
export default class LabLocationsResolver {
  @Query(() => [GooglePlacesSearchResult])
  async labLocations(
    @Arg("input") { location, radius, type, query }: GooglePlacesSearchInput
  ) {
    return await getLocationsFromGoogleAutoComplete(
      query,
      location,
      radius,
      type
    )
  }
}
