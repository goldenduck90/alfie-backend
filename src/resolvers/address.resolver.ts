import axios from "axios"
import {
  AddressQuery,
  AddressSuggestion,
  Address,
} from "./../schema/user.schema"
import { Resolver, Query, Arg } from "type-graphql"

interface AddressPrediction {
  description: string
  place_id: string
}

interface GooglePlaceAutocompleteResponse {
  predictions: AddressPrediction[]
}

interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

interface GooglePlaceDetailResponse {
  result: {
    address_components: AddressComponent[]
    formatted_address: string
  }
}

const BASE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"

function fillAddressFromGooglePlaceDetail(
  data: GooglePlaceDetailResponse
): Address {
  const address: Address = {
    line1: "",
    city: "",
    state: "",
    postalCode: "",
  }

  data.result.address_components.forEach((component) => {
    const types = component.types

    if (types.includes("street_number")) {
      address.line1 = `${component.long_name} ${address.line1 || ""}`
    } else if (types.includes("route")) {
      address.line1 = `${address.line1 || ""} ${component.long_name}`
    } else if (types.includes("locality")) {
      address.city = component.long_name
    } else if (types.includes("administrative_area_level_1")) {
      address.state = component.short_name
    } else if (types.includes("postal_code")) {
      address.postalCode = component.short_name
    } else if (types.includes("country")) {
      address.country = component.short_name
    } else if (types.includes("sublocality_level_1")) {
      address.line2 = component.long_name
    }
  })

  return address
}

@Resolver()
class AddressAutocompleteResolver {
  @Query(() => [AddressSuggestion])
  async addressSuggestions(
    @Arg("query") query: AddressQuery
  ): Promise<AddressSuggestion[]> {
    try {
      const queryStr = `${query.input}, USA` // Limit in US only
      const response = await axios.get<GooglePlaceAutocompleteResponse>(
        `${BASE_URL}?key=${process.env.GOOGLE_API_KEY}&input=${queryStr}&radius=${query.radius}&types=address`
      )
      const predictions = response.data.predictions

      return predictions.map((prediction) => ({
        address: prediction.description,
        placeId: prediction.place_id,
      }))
    } catch (error) {
      throw new Error(error)
    }
  }

  @Query(() => Address)
  async addressDetail(@Arg("placeId") placeId: string): Promise<Address> {
    try {
      const response = await axios.get<GooglePlaceDetailResponse>(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${process.env.GOOGLE_API_KEY}&types=regions`
      )
      return fillAddressFromGooglePlaceDetail(response.data)
    } catch (error) {
      throw new Error("Failed to get place details")
    }
  }
}

export default AddressAutocompleteResolver
