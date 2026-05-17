import { ok } from "@/lib/api-response";

const representatives = [
  {
    lab: "Aspen",
    focus: "Cardiometabolismo, dolor y medicina interna",
    representative: "Lic. Mariana Aranda",
    zone: "León, Guanajuato",
    phone: "+52 477 120 8842",
    email: "mariana.aranda@aspen-vitaeon.mx"
  },
  {
    lab: "AstraZeneca",
    focus: "Cardiología, neumología, oncología y metabolismo",
    representative: "Dr. Rodrigo Salvatierra",
    zone: "Bajío médico",
    phone: "+52 477 318 2047",
    email: "rodrigo.salvatierra@az-vitaeon.mx"
  },
  {
    lab: "Sanofi",
    focus: "Diabetes, vacunas, inmunología y atención crónica",
    representative: "Lic. Andrea Ledesma",
    zone: "León y corredor industrial",
    phone: "+52 477 590 7311",
    email: "andrea.ledesma@sanofi-vitaeon.mx"
  },
  {
    lab: "Novartis",
    focus: "Oftalmología, reumatología, neurología y medicina especializada",
    representative: "Mtro. Gabriel Muñoz",
    zone: "Guanajuato centro",
    phone: "+52 477 642 1905",
    email: "gabriel.munoz@novartis-vitaeon.mx"
  }
];

export async function GET() {
  return ok(representatives);
}
