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

export interface IEACustomer {
  id: number
  name?: string
  firstName?: string
  lastName?: string
  address?: string
  city?: string
  zip?: string
  notes?: string
  email?: string
  phone?: string
}

export interface IEAService {
  id: number
  name?: string
  duration?: number
  durationInMins?: number
  price?: number
  currency?: string
  description?: string
  location?: string
  availabilitiesType?: string
  attendantsNumber?: number
  categoryId?: number
}

export interface IEAProvider {
  id?: number
  name?: string
  type?: string
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
  timezone?: string
  numberOfPatients?: number
  minAdvancedNotice?: number
  bufferTime?: number
  services?: number[]
  settings?: Settings
}

export interface IEAAppointment {
  eaAppointmentId?: number
  start?: string
  end?: string
  location?: string
  timezone?: string
  notes?: string
  eaProvider?: IEAProvider
  eaService?: IEAService
  eaCustomer?: IEACustomer
  providerAttended?: boolean
  patientAttended?: boolean
  attendanceEmailSent?: boolean
  claimSubmitted?: boolean
}
