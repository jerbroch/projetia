"use client";

import { useRef, useState } from "react";
import type { ScheduleEvent } from "@/types";
import { isoToLocalDateTime, isoToZonedMinutes } from "@/lib/schedule-timezone";
import { getScheduleBlockAppearance } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import {
  HOUR_WIDTH,
  metriquesDeLigne,
  clampMinutes,
  minutesToTimeValue,
  snapMinutes,
} from "@/lib/calendar-utils";
import {
  apercuDeplacement,
  apercuRedimensionnement,
  apercuRedimensionnementDebut,
  gaucheEnPixels,
  largeurEnPixels,
  type ApercuPlage,
} from "@/lib/calendar-drag-preview";

interface CalendarJobBlockProps {
  event: ScheduleEvent;
  left: number;
  width: number;
  lane: number;
  laneCount: number;
  rowEmployeeId: string | null;
  onClick: (event: ScheduleEvent) => void;
  onMove: (event: ScheduleEvent, sourceEmployeeId: string | null, targetEmployeeId: string | null, startMinutes: number, clientX: number) => void;
  onResize: (event: ScheduleEvent, endMinutes: number) => void;
  /** Redimensionnement par la gauche : la fin ne bouge pas. */
  onResizeStart: (event: ScheduleEvent, startMinutes: number) => void;
  getMinutesFromClientX: (clientX: number) => number;
  getEmployeeIdFromClientY: (clientY: number) => string | null;
  /** Position gauche, en pixels, d'un bloc déposé sous ce curseur. */
  getLeftFromClientX: (clientX: number) => number;
}

export function CalendarJobBlock({
  event,
  left,
  width,
  lane,
  laneCount,
  rowEmployeeId,
  onClick,
  onMove,
  onResize,
  onResizeStart,
  getMinutesFromClientX,
  getEmployeeIdFromClientY,
  getLeftFromClientX,
}: CalendarJobBlockProps) {
  const interaction = useRef<{ mode: "move" | "resize" | "resize-start"; startX: number; startMinutes: number; endMinutes: number; moved: boolean } | null>(null);

  /**
   * Aperçu du geste en cours.
   *
   * Il est en ÉTAT, pas en référence : c'est tout le correctif. L'état du
   * geste vivait dans `interaction`, et muter une référence ne déclenche aucun
   * rendu — le bloc ne pouvait donc pas suivre la souris, et l'heure
   * n'apparaissait qu'au relâchement.
   */
  const [apercu, setApercu] = useState<(ApercuPlage & { left?: number }) | null>(null);
  const appearance = getScheduleBlockAppearance(event.status);

  // Même source de vérité que la ligne : c'est ce qui garantit que le bloc ne
  // déborde jamais de la ligne qui le contient.
  const metriques = metriquesDeLigne(laneCount);
  const laneHeight = metriques.laneHeight;
  const top = metriques.top(lane);


  const enGeste = apercu !== null;

  // Ce qui tient dans la hauteur disponible. Sur une ligne compacte on garde
  // l'essentiel : ce qu'on fait et quand. Le reste s'obtient en ouvrant le
  // call. Pendant un geste l'heure passe devant tout : c'est l'information
  // qu'on cherche en tirant.
  const afficheHeures = laneHeight >= 30 || enGeste;
  const afficheClient = laneHeight >= 44 && !enGeste;
  const afficheDetail = laneHeight >= 64 && !enGeste;
  const gauche = apercu?.left ?? left;
  const largeur = apercu ? largeurEnPixels(apercu) : width;
  const libelleHeures = apercu
    ? `${minutesToTimeValue(apercu.startMinutes)} – ${minutesToTimeValue(apercu.endMinutes)}`
    : `${isoToLocalDateTime(event.start).time} – ${isoToLocalDateTime(event.end).time}`;

  function beginMove(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.handle === "resize") return;
    e.stopPropagation();
    const startMinutes = isoToZonedMinutes(event.start);
    const endMinutes = isoToZonedMinutes(event.end);
    interaction.current = { mode: "move", startX: e.clientX, startMinutes, endMinutes, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function beginResize(e: React.PointerEvent) {
    demarrerPoignee(e, "resize");
  }

  function beginResizeStart(e: React.PointerEvent) {
    demarrerPoignee(e, "resize-start");
  }

  function demarrerPoignee(e: React.PointerEvent, mode: "resize" | "resize-start") {
    e.stopPropagation();
    const startMinutes = isoToZonedMinutes(event.start);
    const endMinutes = isoToZonedMinutes(event.end);
    interaction.current = { mode, startX: e.clientX, startMinutes, endMinutes, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const state = interaction.current;
    if (!state) return;
    if (Math.abs(e.clientX - state.startX) > 4) {
      state.moved = true;
    }
    if (!state.moved) return;

    if (state.mode === "resize") {
      setApercu(
        apercuRedimensionnement(state.startMinutes, state.endMinutes, e.clientX - state.startX),
      );
      return;
    }

    if (state.mode === "resize-start") {
      const plage = apercuRedimensionnementDebut(
        state.startMinutes,
        state.endMinutes,
        e.clientX - state.startX,
      );
      // Le bord gauche bouge, donc la position du bloc aussi : sans ce décalage
      // il s'étirerait vers la gauche sans jamais déplacer son bord.
      setApercu({ ...plage, left: left + gaucheEnPixels(plage.startMinutes) - gaucheEnPixels(state.startMinutes) });
      return;
    }

    setApercu({
      ...apercuDeplacement(state.startMinutes, state.endMinutes, getMinutesFromClientX(e.clientX)),
      left: getLeftFromClientX(e.clientX),
    });
  }

  function annulerGeste() {
    interaction.current = null;
    setApercu(null);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!interaction.current) return;
    const state = interaction.current;
    interaction.current = null;
    setApercu(null);

    if (!state.moved && state.mode === "move") {
      onClick(event);
      return;
    }

    if (state.mode === "resize") {
      const deltaMinutes = snapMinutes(((e.clientX - state.startX) / HOUR_WIDTH) * 60);
      onResize(event, clampMinutes(state.endMinutes + deltaMinutes));
      return;
    }

    if (state.mode === "resize-start") {
      const deltaMinutes = snapMinutes(((e.clientX - state.startX) / HOUR_WIDTH) * 60);
      onResizeStart(event, clampMinutes(state.startMinutes + deltaMinutes));
      return;
    }

    const newStartMinutes = clampMinutes(getMinutesFromClientX(e.clientX));
    const targetEmployeeId = getEmployeeIdFromClientY(e.clientY);
    onMove(event, rowEmployeeId, targetEmployeeId, newStartMinutes, e.clientX);
  }

  return (
    <div
      data-event-id={event.id}
      className={cn(
        "absolute overflow-hidden rounded-md border px-2 py-1 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing",
        // Pendant le geste on passe au-dessus des voisins et on coupe la
        // transition : une animation ferait traîner le bloc derrière la souris.
        enGeste ? "z-30 shadow-lg ring-2 ring-primary/60" : "z-10 transition-shadow",
        appearance.className
      )}
      style={{ left: gauche, width: largeur, top, height: laneHeight }}
      onPointerDown={beginMove}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={annulerGeste}
    >
      <div className="pointer-events-none space-y-0 leading-tight">
        {afficheDetail && event.jobNumber && (
          <p className="truncate text-[10px] font-bold opacity-95">{event.jobNumber}</p>
        )}
        <p className="truncate text-[11px] font-semibold leading-tight">{event.title}</p>
        {afficheClient && (
          <p className="truncate text-[10px] opacity-90">{event.customerName}</p>
        )}
        {afficheDetail && (
          <p className="hidden truncate text-[10px] opacity-80 sm:block">
            {event.jobSiteAddress ?? event.location}
          </p>
        )}
        {afficheHeures && (
          <p
            data-testid="bloc-heures"
            className={cn("truncate text-[10px]", enGeste ? "font-bold opacity-100" : "opacity-80")}
          >
            {libelleHeures}
          </p>
        )}
      </div>
      <div
        data-handle="resize"
        title="Reculer ou avancer le début"
        className="absolute bottom-0 left-0 top-0 w-2 cursor-ew-resize bg-black/10"
        onPointerDown={beginResizeStart}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={annulerGeste}
      />
      <div
        data-handle="resize"
        title="Allonger ou raccourcir la fin"
        className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize bg-black/10"
        onPointerDown={beginResize}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={annulerGeste}
      />
    </div>
  );
}
