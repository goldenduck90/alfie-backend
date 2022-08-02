import { Request, Response } from "express"
import { User } from "../schema/user.schema"

interface Context {
  req: Request & { user?: User }
  res: Response
  user: User | null
}

export default Context
