export interface Break {
  start?: string
  end?: string
}

export interface Day {
  start?: string
  end?: string
  breaks?: Break[]
}

export interface WorkingPlan {
  monday?: Day
  tuesday?: Day
  wednesday?: Day
  thursday?: Day
  friday?: Day
  saturday?: Day
  sunday?: Day
}

export interface Break5 {
  start?: string
  end?: string
}

export interface Settings {
  username?: string
  password?: string
  notifications?: boolean
  googleSync?: boolean
  googleCalendar?: string
  googleToken?: string
  syncFutureDays?: number
  syncPastDays?: number
  calendarView?: string
  workingPlan?: WorkingPlan
}

export interface IEAProvider {
  id?: number
  firstName?: string
  lastName?: string
  email?: string
  mobile?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  notes?: string
  services?: number[]
  settings?: Settings
}

export interface IEAAppointment {
  eaAppointmentId: string
  start: string
  end: string
  location: string
  timezone: string
  notes: string
  eaProvider: IEAProvider
  eaService: {
    id: string
    name: string
    durationInMins: number
    description: string
  }
  eaCustomer: {
    id: string
    name: string
    email: string
    phone: string
  }
}
