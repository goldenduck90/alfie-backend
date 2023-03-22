import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios from "axios"
import { Arg, Ctx, Query, Resolver } from "type-graphql"
import {
  PharmacyLocationInput,
  PharmacyLocationResult
} from "../schema/akute.schema"
import {
  GooglePlacesSearchInput,
  GooglePlacesSearchResult,
  GoogleReverseGeoCodeResult
} from "../schema/googlePlaces.schema"
import { UserModel } from "../schema/user.schema"
import AkuteService from "../services/akute.service"
import Context from "../types/context"
const akuteService = new AkuteService()
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
    Sentry.captureException(error)
    return []
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
    Sentry.captureException(error)
    return []
  }
}

export async function getPharmacyLocationsFromAkute(
  input: PharmacyLocationInput,
  userId: string
) {
  try {
    const response = await akuteService.getPharmacyLocations(input, userId)
    return response
  } catch (error) {
    Sentry.captureException(error)
    return []
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

  @Query(() => [PharmacyLocationResult])
  async pharmacyLocations(
    @Arg("input") input: PharmacyLocationInput,
    @Ctx() context: Context
  ) {
    return await getPharmacyLocationsFromAkute(input, context.user._id)
  }
}
