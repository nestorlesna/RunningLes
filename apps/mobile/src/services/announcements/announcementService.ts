import * as Speech from 'expo-speech'

const OPTIONS: Speech.SpeechOptions = {
  language: 'es-AR',
  pitch: 1.0,
  rate: 0.9,
}

export function announceKm(totalKm: number) {
  const text = totalKm === 1 ? 'Un kilómetro' : `${totalKm} kilómetros`
  Speech.speak(text, OPTIONS)
}

export function announceTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  let text: string
  if (hours === 0) {
    text = `${totalMinutes} minutos`
  } else if (mins === 0) {
    text = hours === 1 ? 'Una hora' : `${hours} horas`
  } else {
    const horaStr = hours === 1 ? 'una hora' : `${hours} horas`
    text = `${horaStr} ${mins} minutos`
  }

  Speech.speak(text, OPTIONS)
}
