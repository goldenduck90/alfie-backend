import { GraphQLScalarType, Kind } from "graphql"

export const GraphQLAnyScalar = new GraphQLScalarType({
  name: "AnyScalar",
  description: "Accepts any scalar value (boolean, string, int, float, null).",
  parseValue: (value) => value,
  parseLiteral: (ast) => {
    switch (ast.kind) {
      case Kind.BOOLEAN:
      case Kind.STRING:
        return ast.value
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value)
      case Kind.NULL:
        return null
      default:
        throw new Error(`Unexpected kind in parseLiteral: ${ast.kind}`)
    }
  },

  serialize: (value) => value,
})
