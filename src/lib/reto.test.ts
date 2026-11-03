import { describe, expect, it } from "vitest";
import { connectionStatus, countReciprocalPairs } from "./reto";

describe("Reto 2.700 reciprocity", () => {
  it("A marks B only → 0 connections", () => {
    expect(countReciprocalPairs([{ from: "a", to: "b" }])).toBe(0);
  });
  it("A marks B and B marks A → 1 connection", () => {
    expect(countReciprocalPairs([{ from: "a", to: "b" }, { from: "b", to: "a" }])).toBe(1);
  });
  it("after unmarking, back to 0", () => {
    expect(countReciprocalPairs([{ from: "b", to: "a" }])).toBe(0);
  });
  it("statuses from my point of view", () => {
    expect(connectionStatus(true, false)).toBe("esperando");
    expect(connectionStatus(false, true)).toBe("por_confirmar");
    expect(connectionStatus(true, true)).toBe("validada");
    expect(connectionStatus(false, false)).toBe("sin_conectar");
  });
});

import { rankBy, pickLeaders, collectiveFromRows, reachedThreshold, nextThreshold, RETO_LEVELS, RETO_MILESTONES, type ScoreRow } from "./reto";

const row = (id: string, name: string, connections: number, bonus = 0): ScoreRow => ({
  user_id: id, display_name: name, company_name: null, participant_type: "drh", photo_url: null,
  connections, bonus, points: connections + bonus,
});

describe("Reto 2.700 scoreboard (fase 3)", () => {
  it("a reciprocal pair adds 1 to the collective once, and 1 to each member", () => {
    // A↔B reciprocal → A:1, B:1, C:0
    expect(collectiveFromRows([row("a", "Ana", 1), row("b", "Bruno", 1), row("c", "Carla", 0)])).toBe(1);
  });
  it("points = personal connections + mission bonus", () => {
    expect(row("a", "Ana", 3, 10).points).toBe(13);
  });
  it("after unmarking, everything goes back to 0", () => {
    expect(collectiveFromRows([row("a", "Ana", 0), row("b", "Bruno", 0)])).toBe(0);
  });
  it("ties share the same position; display order is stable by name", () => {
    const r = rankBy([row("c", "Carla", 1), row("a", "Ana", 2), row("b", "Bruno", 2)], "connections");
    expect(r.map((x) => [x.display_name, x.rank])).toEqual([["Ana", 1], ["Bruno", 1], ["Carla", 3]]);
  });
  it("Alma Conectamos excludes the Superconector winner", () => {
    const l = pickLeaders([row("a", "Ana", 5, 0), row("b", "Bruno", 3, 1)]);
    expect(l.superconector?.user_id).toBe("a");
    expect(l.alma?.user_id).toBe("b");
  });
  it("milestones 900/1800/2700 and personal levels 9/27/54", () => {
    expect(reachedThreshold(1799, RETO_MILESTONES)).toBe(900);
    expect(nextThreshold(1799, RETO_MILESTONES)).toBe(1800);
    expect(reachedThreshold(27, RETO_LEVELS)).toBe(27);
    expect(nextThreshold(54, RETO_LEVELS)).toBeNull();
  });
});

import { missionMaxBonus, missionRatio, missionState } from "./reto";

describe("Reto 2.700 missions display", () => {
  it("awarded once-only mission is completed", () => {
    expect(missionState({ awarded_count: 1, max_awards: 1, blocked_reason: null })).toBe("completada");
  });
  it("not yet reached and open → in progress", () => {
    expect(missionState({ awarded_count: 0, max_awards: 1, blocked_reason: null })).toBe("en_curso");
  });
  it("disabled or locked mission without award → blocked", () => {
    expect(missionState({ awarded_count: 0, max_awards: 1, blocked_reason: "Desactivada" })).toBe("bloqueada");
  });
  it("progress ratio is capped at the threshold", () => {
    expect(missionRatio(2, 3)).toBeCloseTo(2 / 3);
    expect(missionRatio(7, 5)).toBe(1);
  });
  it("Te presento max bonus is 3 × 40 = 120", () => {
    expect(missionMaxBonus({ bonus_points: 40, max_awards: 3 })).toBe(120);
  });
});
