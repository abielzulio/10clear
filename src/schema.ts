export interface Root {
  message: string
  revised: boolean
  metadata: Metadata
  result: Children[]
}

export interface Metadata {
  title: string
  markdown: string
}

export interface Children {
  id: string
  type: string
  level: number
  page: number
  mainFont: string
  mainlyItalic: boolean
  mainlyBold: boolean
  avgFontSize: number
  value: string
  mainFontSize: number
  mainRGBColor: number[]
  bbox: number[]
  children: Children[]
}

export interface Children2 {
  id: string
  type: string
  level: number
  page: number
  mainFont: string
  mainlyItalic: boolean
  mainlyBold: boolean
  avgFontSize: number
  value: string
  mainFontSize: number
  mainRGBColor: number[]
  bbox: number[]
  children: Children3[]
}

export interface Children3 {
  id: string
  type: string
  level: number
  page: number
  mainFont: string
  mainlyItalic: boolean
  mainlyBold: boolean
  avgFontSize: number
  value: string
  mainFontSize: number
  mainRGBColor: number[]
  bbox: number[]
  children: Children4[]
}

export interface Children4 {
  type: string
  value: string
  children: Children5[]
  id?: string
  level?: number
  page?: number
  mainFont?: string
  mainlyItalic?: boolean
  mainlyBold?: boolean
  avgFontSize?: number
  mainFontSize?: number
  mainRGBColor?: number[]
  bbox?: number[]
}

export interface Children5 {
  type: string
  value: string
  children?: Children6[]
  id?: string
  level?: number
  page?: number
  mainFont?: string
  mainlyItalic?: boolean
  mainlyBold?: boolean
  avgFontSize?: number
  mainFontSize?: number
  mainRGBColor?: number[]
  bbox?: number[]
}

export interface Children6 {
  id?: string
  type: string
  level?: number
  page?: number
  mainFont?: string
  mainlyItalic?: boolean
  mainlyBold?: boolean
  avgFontSize?: number
  value: string
  mainFontSize?: number
  mainRGBColor?: number[]
  bbox?: number[]
  children?: Children7[]
}

export interface Children7 {
  id?: string
  type: string
  level?: number
  page?: number
  mainFont?: string
  mainlyItalic?: boolean
  mainlyBold?: boolean
  avgFontSize?: number
  value: string
  mainFontSize?: number
  mainRGBColor?: number[]
  bbox?: number[]
  children?: Children8[]
}

export interface Children8 {
  id?: string
  type: string
  level?: number
  page?: number
  mainFont?: string
  mainlyItalic?: boolean
  mainlyBold?: boolean
  avgFontSize?: number
  value: string
  mainFontSize?: number
  mainRGBColor?: number[]
  bbox?: number[]
  children?: unknown[]
}
