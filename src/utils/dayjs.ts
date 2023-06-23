import dayjs from "dayjs"
import tz from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import advanced from "dayjs/plugin/advancedFormat"

dayjs.extend(utc)
dayjs.extend(tz)
dayjs.extend(advanced)

/** Export an extended dayjs object. */
export default dayjs
