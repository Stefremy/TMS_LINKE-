import type { CalendarEvent } from "../types";
import { addDays, dateKey } from "./dates";
/** Existing PT/ES operational references. Regional/facultative dates are labelled explicitly. */
export function calendarHolidays(start: string, end: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (
    let year = Number(start.slice(0, 4));
    year <= Number(end.slice(0, 4));
    year++
  ) {
    const a = year % 19,
      b = Math.floor(year / 100),
      c = year % 100,
      d = Math.floor(b / 4),
      e = b % 4,
      f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4),
      k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31),
      day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = dateKey(new Date(Date.UTC(year, month - 1, day)));
    const fixed: Record<"PT" | "ES", [string, string][]> = {
      PT: [
        ["01-01", "Ano Novo"],
        ["04-25", "Dia da Liberdade"],
        ["05-01", "Dia do Trabalhador"],
        ["06-10", "Dia de Portugal"],
        ["08-15", "Assunção de Nossa Senhora"],
        ["10-05", "Implantação da República"],
        ["11-01", "Todos os Santos"],
        ["12-01", "Restauração da Independência"],
        ["12-08", "Imaculada Conceição"],
        ["12-25", "Natal"],
      ],
      ES: [
        ["01-01", "Ano Novo"],
        ["01-06", "Dia de Reis"],
        ["05-01", "Dia do Trabalhador"],
        ["08-15", "Assunção de Nossa Senhora"],
        ["10-12", "Festa Nacional de Espanha"],
        ["11-01", "Todos os Santos"],
        ["12-06", "Dia da Constituição"],
        ["12-08", "Imaculada Conceição"],
        ["12-25", "Natal"],
      ],
    };
    for (const country of ["PT", "ES"] as const) {
      const dates = fixed[country].map(([md, title]) => ({
        date: `${year}-${md}`,
        title,
      }));
      dates.push({ date: addDays(easter, -2), title: "Sexta-feira Santa" });
      if (country === "PT")
        dates.push(
          { date: easter, title: "Páscoa" },
          { date: addDays(easter, 60), title: "Corpo de Deus" },
          { date: addDays(easter, -47), title: "Carnaval (facultativo)" },
        );
      else
        dates.push(
          { date: addDays(easter, -3), title: "Quinta-feira Santa (regional)" },
          {
            date: addDays(easter, 1),
            title: "Segunda-feira de Páscoa (regional)",
          },
        );
      for (const item of dates)
        if (item.date >= start && item.date <= end)
          events.push({
            id: `holiday-${country}-${item.date}`,
            title: `${country} · ${item.title}`,
            description:
              "Referência operacional. Os feriados regionais e facultativos dependem da localidade e da empresa.",
            start_date: item.date,
            end_date: item.date,
            time: null,
            all_day: true,
            collab_id: `holiday-${country}`,
            creator_email: null,
            creator_id: null,
            updated_at: "",
            shipment_tracking_number: null,
            read_only: true,
            holiday_country: country,
          });
    }
  }
  return events;
}
