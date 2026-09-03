"use client";

import { useEffect, useRef, useState } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { useSession } from "@/lib/auth-client";
import { parseClassInfo, cn } from "@/features/schedule-helper/lib/utils";
import { Search, X, Check, ArrowRightLeft, ArrowLeft, ArrowRight, Star, Pin, FilePlus2 } from "lucide-react";
import MakeupTray from "@/features/schedule-helper/components/makeup/MakeupTray";
import { useMakeupTray } from "@/features/schedule-helper/components/makeup/useMakeupTray";
import { absentDateOf, dateForWeekday, exchangeDateOf, koreanDate } from "@/features/schedule-helper/lib/makeup/buildRows";
import type { ClassSlot, MakeupEntry, MakeupKind } from "@/features/schedule-helper/lib/makeup/types";

interface SearchResult {
  teacher: string;
  day?: string;
  period?: number;
  subject?: string;
  isSub?: boolean;
}

interface ChainResult {
  // 나 → B: 내 수업을 B 선생님의 수업과 교체 (2순위 교체와 동일한 조건)
  b: { teacher: string; day: string; period: number; subject: string };
  // B가 지금 이 시간(선택한 셀)에 이미 가진 수업 — 이것 때문에 B가 바로는 교체를 못 받음
  w: { subject: string };
  // B ↔ C: B의 w 수업을 C와 교체해서 B를 이 시간에 비워줌
  c: { teacher: string; day: string; period: number; subject: string };
}

/** 셀 폭이 좁아 과목명은 5자 넘으면 줄입니다(그리드 셀·확정 배지 공용). */
function truncateSubject(subject: string) {
  return subject.length > 5 ? subject.substring(0, 4) + ".." : subject;
}

/**
 * 보강원 트레이에 이미 담긴 슬롯을 그리드에 표시하는 배지.
 *
 * role "origin" = 결강 교사 본인 행의 그 슬롯 — "내가 어디로 이동했는지"를 보여줍니다
 * (교체면 교체대상 시간/과목, 보강이면 누가 대신 하는지). 아무 데도 안 옮기는 보강은
 * 그 자체로 표시할 게 이동 정보가 아니라 대신 하는 사람 이름입니다.
 * role "exchange" = 교체대상 교사 행의 그 슬롯(교체를 담았을 때만 존재) — 원래 그 자리를
 * 맡았던 사람 대신 결강 교사가 와서 가르친다는 걸 보여줍니다.
 */
function CommittedCell({ entry, role }: { entry: MakeupEntry; role: "origin" | "exchange" }) {
  if (role === "origin" && entry.kind === "sub") {
    return (
      <div className="flex flex-col items-center justify-center leading-tight text-amber-800">
        <Check className="w-3 h-3" />
        <span className="text-[9px] sm:text-[10px] font-bold truncate w-full px-0.5">보강 · {entry.partnerTeacher}</span>
      </div>
    );
  }
  // 여기부터는 kind === "swap"이라 entry.exchange가 항상 채워져 있습니다(교체를 담을 때만 exchange를 넘김).
  const dest = entry.exchange!;
  if (role === "origin") {
    return (
      <div className="flex flex-col items-center justify-center leading-tight text-amber-800">
        <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold">
          <ArrowRight className="w-2.5 h-2.5 shrink-0" /> {dest.day}{dest.period}
        </span>
        <span className="text-[9px] sm:text-[10px] truncate w-full px-0.5">{truncateSubject(dest.subject)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center leading-tight text-amber-800">
      <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold">
        <ArrowLeft className="w-2.5 h-2.5 shrink-0" /> {entry.absentTeacher}
      </span>
      <span className="text-[9px] sm:text-[10px] truncate w-full px-0.5">{truncateSubject(dest.subject)}</span>
    </div>
  );
}

/**
 * 확정된 슬롯에 마우스를 올렸을 때 보여줄 전체 설명(그리드 배지는 공간이 좁아 축약돼 있어서).
 * 실제 결강/교체 날짜(baseDate 기준 계산값)를 같이 보여줍니다 — 아래 isTeacherBusyViaTray가
 * "요일이 같아도 주가 다르면 안 겹친다"로 판정을 바꾼 뒤로는, 사용자가 "이게 정확히 언제
 * 얘기인지"를 바로 확인할 수 있어야 왜 막혔는지/왜 안 막혔는지를 신뢰할 수 있습니다.
 */
function committedTooltip(entry: MakeupEntry, role: "origin" | "exchange", baseDate: string) {
  if (role === "origin" && entry.kind === "sub") {
    return `${entry.absentTeacher} 선생님 결강(${koreanDate(absentDateOf(entry, baseDate))}) → ${entry.partnerTeacher} 선생님이 보강 (보강원 트레이에 담김 · 오른쪽 패널에서 뺄 수 있습니다)`;
  }
  const dest = entry.exchange!;
  if (role === "origin") {
    return `${entry.absentTeacher} 선생님 결강(${koreanDate(absentDateOf(entry, baseDate))}) → ${entry.partnerTeacher} 선생님과 교체, 대신 ${koreanDate(exchangeDateOf(entry, baseDate))} ${dest.period}교시 ${dest.subject} 수업으로 이동 (보강원 트레이에 담김 · 오른쪽 패널에서 뺄 수 있습니다)`;
  }
  return `${entry.partnerTeacher} 선생님의 ${koreanDate(exchangeDateOf(entry, baseDate))} ${dest.period}교시 ${dest.subject} 수업을 ${entry.absentTeacher} 선생님이 대신 감 (보강원 트레이에 담김 · 오른쪽 패널에서 뺄 수 있습니다)`;
}

/** "여기는 교체 불가능해"를 라벨 없이 보여주는 대각선 빗금. 아래 busyElsewhereEntry 칸에만 씁니다. */
const HATCH_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(180,83,9,0.22) 0px, rgba(180,83,9,0.22) 4px, transparent 4px, transparent 10px)",
} as const;

/**
 * 교체로 담긴 슬롯 때문에, 결강 교사 본인 시간표에서 원래 비어 있던 칸이 실은 못 쓰게 된
 * 경우에 붙는 설명. (박교체의 수4 자리로 대신 가르치러 가므로, 내 시간표의 수4는 원래
 * 빈칸이어도 실제로는 그 시간에 내가 없습니다 — 매칭 알고리즘은 이 사실을 모르므로
 * 빗금으로 직접 알려줍니다.)
 */
function busyElsewhereTooltip(entry: MakeupEntry, baseDate: string) {
  const dest = entry.exchange!;
  return `${entry.absentTeacher} 선생님은 ${koreanDate(exchangeDateOf(entry, baseDate))} ${dest.period}교시에 ${entry.partnerTeacher} 선생님 대신 ${dest.subject} 수업을 하러 가 있습니다. 원래 시간표는 비어 있어도 이 시간엔 다른 교체를 잡을 수 없습니다 (보강원 트레이에 담김 · 오른쪽 패널에서 뺄 수 있습니다).`;
}

/**
 * teacher가 실제로 그 날짜(date)·교시에 이미 트레이의 다른 건으로 묶여 있는지.
 *
 * 매칭 검색 자체는 원본 시간표(row[day+period])와 관리자 교체 불가 설정만 보고 후보를
 * 뽑기 때문에, 방금 트레이에 담은 다른 교체·보강 건은 전혀 모릅니다. 그래서 예를 들어
 * "강연주가 이미 다른 교체로 화요일 7교시에 가 있는" 상태에서도, 화요일 7교시에 수업이
 * 있는 다른 선생님이 계속 교체 후보로 나옵니다. 두 가지 경우를 확인합니다.
 *  1) teacher가 다른 교체 건의 결강 교사라서 그 시간에 이미 대신 가르치러 가 있는 경우
 *  2) teacher가 다른 건의 대체 교사로 이미 그 시간을 맡기로 한 경우(교체·보강 모두)
 *
 * 요일 문자열이 아니라 **실제 날짜**로 비교합니다 — 바꾸는 두 수업이 같은 요일·교시라도
 * 서로 다른 주(baseDate 기준으로 계산했을 때 다른 날짜, 또는 항목별 날짜 override로 다른
 * 날을 가리키는 경우)라면 실제로는 겹치지 않으므로 "교체 불가"로 막으면 안 됩니다.
 */
function isTeacherBusyViaTray(entries: MakeupEntry[], teacher: string, date: string, period: number, baseDate: string): boolean {
  return entries.some((e) => {
    if (e.kind === "swap" && e.absentTeacher === teacher && e.exchange?.period === period && exchangeDateOf(e, baseDate) === date) {
      return true;
    }
    return e.partnerTeacher === teacher && e.absent.period === period && absentDateOf(e, baseDate) === date;
  });
}

/**
 * 후보 하나를 식별하는 키. 겹침 후보마다 사용자가 입력 중인 날짜(pendingDates)를 따로
 * 기억해야 해서 필요합니다 — exchangeSlot이 있으면 교체 후보, 없으면 보강(동과 대강) 전용
 * 후보라 partnerTeacher만으로 구분합니다.
 */
function candidateKey(partnerTeacher: string, exchangeSlot?: { day: string; period: number }) {
  return exchangeSlot ? `${partnerTeacher}|${exchangeSlot.day}|${exchangeSlot.period}` : `${partnerTeacher}|sub`;
}

/** 후보 하나(교체·보강)에 사용자가 겹침을 풀려고 직접 입력 중인 날짜. */
interface PendingDates {
  absentDateOverride?: string;
  exchangeDateOverride?: string;
}

export default function SwapTab() {
  const { data, isBlocked, isSubjectBlocked, isTeacherBlocked } = useSchedule();
  const { data: session } = useSession();
  const [selectedCell, setSelectedCell] = useState<{ teacher: string; day: string; period: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<{ swap: SearchResult[]; sub: SearchResult[]; chain: ChainResult[] }>({ swap: [], sub: [], chain: [] });
  const [selectedChainIdx, setSelectedChainIdx] = useState<number | null>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [stickyTop, setStickyTop] = useState(0);
  // 보강원 작성 트레이 — 후보를 여러 건 담아 한 장으로 만듭니다.
  // (조기 return보다 위에 있어야 훅 순서가 어긋나지 않습니다.)
  const tray = useMakeupTray();

  // 그리드에서 초록 후보 셀을 직접 눌렀을 때 뜨는 "교체/보강 바로 고르기" 팝오버.
  // rect는 클릭 시점 셀의 화면 좌표 스냅샷(고정 위치 팝오버를 그 위치에 앵커링하는 용도) —
  // DOMRect를 그대로 들고 있으면 스크롤에 따라 값이 바뀌므로 숫자만 복사해 둡니다.
  const [quickPick, setQuickPick] = useState<{
    teacher: string;
    day: string;
    period: number;
    rect: { top: number; left: number; width: number; height: number };
  } | null>(null);
  const quickPickRef = useRef<HTMLDivElement>(null);

  // 겹침으로 뜬 후보마다 사용자가 "실제로는 다른 날짜"라고 직접 고쳐 입력 중인 날짜.
  // candidateKey로 후보별 따로 두어야, 한 후보의 날짜를 고치는 게 다른 후보에 영향을 안 줍니다.
  const [pendingDates, setPendingDates] = useState<Record<string, PendingDates>>({});

  // 팝오버가 열려 있을 때 바깥을 누르면 닫습니다. 팝오버를 연 바로 그 클릭이 곧장 다시
  // 닫아버리지 않도록 리스너 등록을 한 틱 미룹니다(버블링 중인 이벤트를 피함).
  useEffect(() => {
    if (!quickPick) return;
    const onDocClick = (e: MouseEvent) => {
      if (quickPickRef.current && !quickPickRef.current.contains(e.target as Node)) setQuickPick(null);
    };
    const t = window.setTimeout(() => document.addEventListener("click", onDocClick), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onDocClick);
    };
  }, [quickPick]);

  // 로그인한 계정 이름과 일치하는 교사 행을 "내 시간표"로 맨 위에 고정하기 위해,
  // 헤더(sticky) 높이만큼 아래로 sticky 위치를 잡아줍니다.
  useEffect(() => {
    if (theadRef.current) setStickyTop(theadRef.current.getBoundingClientRect().height);
  }, [data]);

  if (!data) return null;

  const myName = session?.user?.name;
  const myRow = myName ? data.tableData.find((r) => r.teacher === myName) : undefined;

  const handleCellClick = (teacher: string, day: string, period: number) => {
    const row = data.tableData.find((r) => r.teacher === teacher);
    const classStr = row?.[day + period];
    if (!classStr) return;

    setSelectedCell({ teacher, day, period });
    setSelectedChainIdx(null);
    setQuickPick(null);
    setPendingDates({});

    if (isTeacherBlocked(teacher)) {
      setResults({ swap: [], sub: [], chain: [] });
      setModalOpen(true);
      return;
    }

    const myInfo = parseClassInfo(classStr);
    if (!myInfo || myInfo.grade === "?" || myInfo.classNum === "?") {
      setResults({ swap: [], sub: [], chain: [] });
      setModalOpen(true);
      return;
    }

    const swapResults: SearchResult[] = [];
    const subResults: SearchResult[] = [];
    const myDept = data.teacherDepts[teacher];
    // 과목 자체가 교체 금지 목록에 있으면 시간을 옮기는 교체(1단계/2단계)는 아예 검색하지 않습니다.
    // 동과 대강은 시간 이동이 없으므로(사람만 바뀜) 과목 금지와 무관하게 정상 동작해야 합니다.
    const subjectBlocked = isSubjectBlocked(myInfo.subject);

    data.tableData.forEach((otherRow) => {
      if (otherRow.teacher === teacher) return;
      if (isTeacherBlocked(otherRow.teacher)) return;

      // Swap Logic
      if (!subjectBlocked) {
        data.days.forEach((dayName) => {
          data.periods.forEach((perNum) => {
            if (isBlocked(otherRow.teacher, dayName, perNum)) return;
            const otherStr = otherRow[dayName + perNum];
            if (otherStr) {
              const oInfo = parseClassInfo(otherStr);
              if (oInfo && oInfo.grade === myInfo.grade && oInfo.classNum === myInfo.classNum && !isSubjectBlocked(oInfo.subject)) {
                if (!otherRow[day + period] && !row[dayName + perNum]) {
                  swapResults.push({
                    teacher: otherRow.teacher,
                    day: dayName,
                    period: perNum,
                    subject: oInfo.subject,
                  });
                }
              }
            }
          });
        });
      }

      // Sub Logic
      if (myInfo.isMovingClass && myDept) {
        const otherDept = data.teacherDepts[otherRow.teacher];
        if (otherDept === myDept && !otherRow[day + period] && !isBlocked(otherRow.teacher, day, period)) {
          subResults.push({ teacher: otherRow.teacher, isSub: true });
        }
      }
    });

    // 1단계(직접 교체) 대상이 없을 때만, 2단계(연쇄 교체) 후보를 찾습니다.
    // B가 나와 같은 반(myInfo)을 다른 시간(dayB,perB)에 가르치고 내가 그 시간에 비어있지만,
    // B가 지금 이 시간(day,period)에 이미 다른 수업(w)이 있어서 막히는 경우 —
    // w와 같은 반을 가르치는 C를 찾아 B↔C를 먼저 교체하면 B가 이 시간에 비게 되어 나↔B 교체가 가능해집니다.
    const chainResults: ChainResult[] = [];
    if (swapResults.length === 0 && !subjectBlocked) {
      outer: for (const bRow of data.tableData) {
        if (bRow.teacher === teacher) continue;
        if (isTeacherBlocked(bRow.teacher)) continue;
        for (const dayB of data.days) {
          for (const perB of data.periods) {
            if (isBlocked(bRow.teacher, dayB, perB)) continue;
            const bStr = bRow[dayB + perB];
            if (!bStr) continue;
            const bInfo = parseClassInfo(bStr);
            if (!bInfo || bInfo.grade !== myInfo.grade || bInfo.classNum !== myInfo.classNum) continue;
            if (isSubjectBlocked(bInfo.subject)) continue;
            if (row[dayB + perB]) continue; // 내가 그 시간에 비어있어야 함
            if (isBlocked(bRow.teacher, day, period)) continue;

            const wStr = bRow[day + period];
            if (!wStr) continue; // B가 이미 이 시간에 비어있으면 1단계로 해결됨 (여기 올 일 없음)
            const wInfo = parseClassInfo(wStr);
            if (!wInfo || wInfo.grade === "?" || wInfo.classNum === "?") continue;
            if (isSubjectBlocked(wInfo.subject)) continue;

            for (const cRow of data.tableData) {
              if (cRow.teacher === teacher || cRow.teacher === bRow.teacher) continue;
              if (isTeacherBlocked(cRow.teacher)) continue;
              for (const dayC of data.days) {
                for (const perC of data.periods) {
                  if (isBlocked(cRow.teacher, dayC, perC)) continue;
                  const cStr = cRow[dayC + perC];
                  if (!cStr) continue;
                  const cInfo = parseClassInfo(cStr);
                  if (!cInfo || cInfo.grade !== wInfo.grade || cInfo.classNum !== wInfo.classNum) continue;
                  if (isSubjectBlocked(cInfo.subject)) continue;
                  if (bRow[dayC + perC]) continue; // B가 그 시간에 비어있어야 함
                  if (cRow[day + period]) continue; // C가 이 시간에 비어있어야 함
                  if (isBlocked(cRow.teacher, day, period)) continue;

                  chainResults.push({
                    b: { teacher: bRow.teacher, day: dayB, period: perB, subject: bInfo.subject },
                    w: { subject: wInfo.subject },
                    c: { teacher: cRow.teacher, day: dayC, period: perC, subject: cInfo.subject },
                  });
                  if (chainResults.length >= 6) break outer;
                }
              }
            }
          }
        }
      }
    }

    setResults({ swap: swapResults, sub: subResults, chain: chainResults });
    setModalOpen(true);
  };

  const selectChain = (idx: number) => {
    setSelectedChainIdx((prev) => (prev === idx ? null : idx));
  };

  const selectedClassStr = selectedCell ? data.tableData.find((r) => r.teacher === selectedCell.teacher)?.[selectedCell.day + selectedCell.period] : null;
  const myInfo = parseClassInfo(selectedClassStr);

  // 지금 선택한 시간에 이미 담긴 항목 (한 시간에 한 사람만 들어갑니다)
  const pickedForCell = selectedCell
    ? tray.entryFor(selectedCell.teacher, selectedCell.day, selectedCell.period)
    : undefined;

  // 지금 이 셀을 위해 이미 담아둔 건(pickedForCell) 자체는 "다른 건과의 충돌"이 아니므로,
  // 후보 막힘 여부를 확인할 때는 제외합니다 — 안 그러면 방금 담은 후보가 곧바로 "교체 불가"로
  // 잘못 보입니다.
  const otherTrayEntries = pickedForCell
    ? tray.entries.filter((e) => e.id !== pickedForCell.id)
    : tray.entries;

  /**
   * 후보를 보강원 트레이에 담습니다.
   * 교체 후보는 나와 **같은 반**을 다른 시간에 가르치는 사람이라(검색 조건이 그렇습니다),
   * 내가 대신 갈 수업의 학년·반은 내 수업과 같습니다.
   */
  const addToTray = (
    kind: MakeupKind,
    partnerTeacher: string,
    exchangeSlot?: { day: string; period: number; subject: string },
    pending?: PendingDates
  ) => {
    if (!selectedCell || !myInfo) return;
    const absent: ClassSlot = {
      day: selectedCell.day,
      period: selectedCell.period,
      grade: myInfo.grade,
      classNum: myInfo.classNum,
      subject: myInfo.subject,
    };
    tray.add({
      kind,
      absentTeacher: selectedCell.teacher,
      absent,
      partnerTeacher,
      exchange: exchangeSlot
        ? { ...exchangeSlot, grade: myInfo.grade, classNum: myInfo.classNum }
        : undefined,
      // 겹침을 풀려고 사용자가 직접 고른 날짜가 있으면 새 항목에 바로 그 날짜를 심어둡니다 —
      // 담고 나서 트레이로 가서 또 고치게 하지 않고, 고른 그대로 반영합니다.
      absentDateOverride: pending?.absentDateOverride,
      exchangeDateOverride: kind === "swap" ? pending?.exchangeDateOverride : undefined,
    });
  };

  /**
   * 후보 하나(partnerTeacher, exchangeSlot 있으면 교체용)의 지금 상태를 판정합니다.
   * 결과 목록 줄(renderPickButtons)과 그리드 클릭 팝오버(quickPick) 양쪽에서 같이 씁니다 —
   * 같은 후보인데 목록과 팝오버의 판정이 어긋나면 안 되므로 로직을 한 곳에 둡니다.
   *
   * 겹침을 "교체"와 "보강" 각각 따로 판정합니다 — 둘이 겹치는 이유가 다르기 때문입니다.
   *  · exchangeConflict: 나(결강 교사)를 교체로 저 시간(exchangeSlot)에 보내야 하는데,
   *    이미 다른 건으로 그 시간에 가 있는 경우. **교체만** 막습니다 — 보강은 내가 어디로도
   *    옮겨가지 않으니 이 충돌과 무관합니다.
   *  · absentConflict: 이 후보 선생님이 지금 내 결강 시간을 대신 맡아야 하는데, 이미 다른
   *    건으로 그 시간을 맡고 있는 경우. 교체·보강 **둘 다** 막습니다.
   * pending에 사용자가 직접 입력 중인 날짜가 있으면 그 값으로, 없으면 결강 주간 기준일
   * (baseDate)로 계산한 기본값으로 판정합니다 — "화7"이라는 요일·교시만으로는 몇 주 뒤
   * 얘기인지 알 수 없어 실제 날짜가 같을 때만 겹치는 것으로 봅니다.
   */
  const getCandidateState = (
    partnerTeacher: string,
    exchangeSlot?: { day: string; period: number; subject: string },
    pending?: PendingDates
  ) => {
    if (!selectedCell) {
      return {
        picked: undefined,
        exchangeDate: undefined as string | undefined,
        absentDate: "",
        exchangeConflict: false,
        absentConflict: false,
        exchangeTitle: undefined as string | undefined,
        absentTitle: undefined as string | undefined,
      };
    }

    const exchangeDate = exchangeSlot
      ? pending?.exchangeDateOverride || dateForWeekday(tray.baseDate, exchangeSlot.day)
      : undefined;
    const absentDate = pending?.absentDateOverride || dateForWeekday(tray.baseDate, selectedCell.day);

    const exchangeConflict =
      !!exchangeSlot && isTeacherBusyViaTray(otherTrayEntries, selectedCell.teacher, exchangeDate!, exchangeSlot.period, tray.baseDate);
    const absentConflict = isTeacherBusyViaTray(otherTrayEntries, partnerTeacher, absentDate, selectedCell.period, tray.baseDate);

    return {
      picked: pickedForCell,
      exchangeDate,
      absentDate,
      exchangeConflict,
      absentConflict,
      exchangeTitle: exchangeConflict
        ? `${selectedCell.teacher} 선생님이 ${koreanDate(exchangeDate!)} ${exchangeSlot!.period}교시에 이미 다른 교체로 다른 곳에 가 있습니다. 이 교체가 실제로 다른 주라면, 아래에서 교체일을 다시 지정해 보세요.`
        : undefined,
      absentTitle: absentConflict
        ? `${partnerTeacher} 선생님이 ${koreanDate(absentDate)} ${selectedCell.period}교시를 이미 다른 교체·보강으로 맡고 있습니다. 이 결강이 실제로 다른 주라면, 아래에서 결강일을 다시 지정해 보세요.`
        : undefined,
    };
  };

  /**
   * 후보 한 줄에 붙는 [교체]/[보강] 버튼.
   *
   * 이미 담긴 시간이면 상태만 보여줍니다. 다른 건과 겹치면(교체·보강 중 막힌 쪽만) 버튼을
   * 완전히 숨기는 대신 비활성화하고, 그 원인이 된 날짜(교체일 또는 결강일)를 바로 옆에서
   * 고칠 수 있는 미니 날짜 선택기를 보여줍니다 — 실제로 다른 주 얘기라면 날짜를 바꾸는
   * 순간 그 자리에서 버튼이 다시 눌리게 됩니다(담기 전에 막혀서 트레이로 가서 날짜를
   * 고칠 기회조차 없었던 문제를 이렇게 풉니다).
   */
  const renderPickButtons = (partnerTeacher: string, exchangeSlot?: { day: string; period: number; subject: string }) => {
    const key = candidateKey(partnerTeacher, exchangeSlot);
    const pending = pendingDates[key];
    const state = getCandidateState(partnerTeacher, exchangeSlot, pending);

    if (state.picked) {
      return state.picked.partnerTeacher === partnerTeacher ? (
        <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-800">
          담김 · {state.picked.kind === "swap" ? "교체" : "보강"}
        </span>
      ) : (
        <span className="shrink-0 text-[11px] text-stone-400" title="이 시간은 이미 다른 분으로 담겨 있습니다.">
          —
        </span>
      );
    }

    const swapAvailable = !!exchangeSlot && !state.exchangeConflict && !state.absentConflict;
    const subAvailable = !state.absentConflict;
    const setPending = (patch: Partial<PendingDates>) =>
      setPendingDates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

    return (
      <div className="shrink-0 flex flex-col items-end gap-1">
        {state.absentConflict && (
          <label className="flex items-center gap-1 text-[10px] font-bold text-rose-500" title={state.absentTitle}>
            겹침·결강일
            <input
              type="date"
              value={pending?.absentDateOverride ?? state.absentDate}
              onChange={(e) => setPending({ absentDateOverride: e.target.value })}
              className="border border-rose-200 rounded px-1 py-0.5 text-[10px] w-[108px]"
            />
          </label>
        )}
        {exchangeSlot && state.exchangeConflict && (
          <label className="flex items-center gap-1 text-[10px] font-bold text-rose-500" title={state.exchangeTitle}>
            겹침·교체일
            <input
              type="date"
              value={pending?.exchangeDateOverride ?? state.exchangeDate}
              onChange={(e) => setPending({ exchangeDateOverride: e.target.value })}
              className="border border-rose-200 rounded px-1 py-0.5 text-[10px] w-[108px]"
            />
          </label>
        )}
        <div className="flex gap-1">
          {exchangeSlot && (
            <button
              disabled={!swapAvailable}
              onClick={() => addToTray("swap", partnerTeacher, exchangeSlot, pending)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg transition-opacity",
                swapAvailable ? "bg-swap hover:opacity-90 text-white" : "bg-stone-100 text-stone-300 cursor-not-allowed"
              )}
            >
              <FilePlus2 className="w-3 h-3" /> 교체
            </button>
          )}
          <button
            disabled={!subAvailable}
            onClick={() => addToTray("sub", partnerTeacher, undefined, pending)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg transition-colors",
              subAvailable ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-stone-100 text-stone-300 cursor-not-allowed"
            )}
          >
            <FilePlus2 className="w-3 h-3" /> 보강
          </button>
        </div>
      </div>
    );
  };

  const renderRow = (row: typeof data.tableData[number], pinned: boolean) => (
    <tr
      key={row.teacher}
      className={cn("transition-colors", pinned ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-emerald-50")}
      style={pinned ? { position: "sticky", top: stickyTop, zIndex: 15 } : undefined}
    >
      <td
        className={cn(
          "p-1 border sticky left-0 z-10 font-bold border-r-2 border-r-swap w-[85px] whitespace-nowrap overflow-hidden text-ellipsis text-center text-[11px] sm:text-xs",
          pinned ? "bg-amber-100 border-stone-200" : "bg-stone-50 border-stone-200"
        )}
      >
        {pinned ? (
          <span className="inline-flex items-center gap-0.5 text-amber-800">
            <Pin className="w-3 h-3 shrink-0" /> {row.teacher}
          </span>
        ) : (
          row.teacher
        )}
      </td>
      {data.days.map((d) =>
        data.periods.map((p, pi) => {
          const classStr = row[d + p];
          const info = parseClassInfo(classStr);
          const isSelected = selectedCell?.teacher === row.teacher && selectedCell?.day === d && selectedCell?.period === p;
          const isPartner = selectedCell && (
            results.swap.some(r => r.teacher === row.teacher && r.day === d && r.period === p) ||
            results.sub.some(r => r.teacher === row.teacher && r.day === d && r.period === p)
          );
          const selectedChain = selectedChainIdx !== null ? results.chain[selectedChainIdx] : undefined;
          // 1단계(B↔C 교체): B의 지금 시간(w) ↔ C의 원래 시간
          const isChainStep1 = !!selectedChain && !!selectedCell && (
            (row.teacher === selectedChain.b.teacher && d === selectedCell.day && p === selectedCell.period) ||
            (row.teacher === selectedChain.c.teacher && d === selectedChain.c.day && p === selectedChain.c.period)
          );
          // 2단계(나↔B 교체): B의 원래 시간으로 내가 이동
          const isChainStep2 = !!selectedChain && row.teacher === selectedChain.b.teacher && d === selectedChain.b.day && p === selectedChain.b.period;

          // 보강원 트레이에 이미 담긴 슬롯이면 매칭을 다시 열 수 없게 막고, 대신 무엇으로 확정됐는지
          // 보여줍니다. 원본(내가 결강하는 자리)과 교체대상(내가 대신 갈 자리) 둘 다 확인합니다 —
          // 연쇄 교체(2단계)는 담기 버튼 자체가 없어(MakeupTray 쪽 설계상 제외) 여기 걸리지 않습니다.
          // 이 칸(d, p)이 결강 주간 기준일(tray.baseDate) 기준으로 실제 몇 월 며칠인지.
          // 아래 세 판정 모두 요일 문자열이 아니라 이 실제 날짜로 비교합니다 — 항목이
          // 날짜 override로 다른 주를 가리키면 겉보기엔 같은 "화7"이어도 이 칸엔 표시되지
          // 않습니다(실제로 이번 주 이 칸은 비어 있는 게 맞으므로).
          const cellDate = dateForWeekday(tray.baseDate, d);
          const originEntry = tray.entryFor(row.teacher, d, p);
          const exchangeEntry = originEntry
            ? undefined
            : tray.entries.find(
                (e) => e.kind === "swap" && e.partnerTeacher === row.teacher && e.exchange?.period === p && exchangeDateOf(e, tray.baseDate) === cellDate
              );
          const committed = originEntry ?? exchangeEntry;
          const committedRole: "origin" | "exchange" | null = originEntry ? "origin" : exchangeEntry ? "exchange" : null;

          // 결강 교사(나) 본인 행에서, 교체대상 시간과 같은 칸 — 원래 시간표엔 빈칸이지만
          // 그 시간엔 내가 대신 다른 반을 가르치러 가 있으므로 실제로는 못 씁니다. committed가
          // 이미 있으면(= 이 칸이 원본/교체대상 자체면) 중복으로 안 겹치게 건너뜁니다.
          const busyElsewhereEntry = committed
            ? undefined
            : tray.entries.find(
                (e) => e.kind === "swap" && e.absentTeacher === row.teacher && e.exchange?.period === p && exchangeDateOf(e, tray.baseDate) === cellDate
              );

          return (
            <td
              key={`${d}-${p}`}
              onClick={(e) => {
                if (committed || !classStr) return;
                if (isPartner) {
                  // 초록 후보 셀을 직접 눌렀습니다 — 새 검색을 시작하는 대신, 이 자리에서
                  // 바로 교체/보강을 고르는 팝오버를 띄웁니다(결과 목록의 같은 줄과 완전히
                  // 같은 판정·같은 addToTray를 씁니다). 같은 셀을 다시 누르면 닫습니다.
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setQuickPick((prev) =>
                    prev && prev.teacher === row.teacher && prev.day === d && prev.period === p
                      ? null
                      : { teacher: row.teacher, day: d, period: p, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } }
                  );
                  return;
                }
                setQuickPick(null);
                handleCellClick(row.teacher, d, p);
              }}
              title={
                committed
                  ? committedTooltip(committed, committedRole!, tray.baseDate)
                  : busyElsewhereEntry
                    ? busyElsewhereTooltip(busyElsewhereEntry, tray.baseDate)
                    : undefined
              }
              style={busyElsewhereEntry ? HATCH_STYLE : undefined}
              className={cn(
                "h-14 border border-stone-200 p-0.5 text-center align-middle transition-colors relative overflow-hidden",
                pi === 0 && "border-l-2 border-l-stone-400",
                classStr && !committed && "cursor-pointer hover:bg-amber-100",
                committed && "cursor-not-allowed bg-amber-50 border-2 border-amber-300",
                busyElsewhereEntry && "cursor-not-allowed bg-amber-50/60 border-2 border-amber-200",
                !committed && isSelected && "bg-swap/15 border-2 border-swap font-bold z-10",
                !committed && isPartner && "bg-emerald-100 border-2 border-emerald-500 font-bold z-10",
                !committed && isChainStep1 && "bg-orange-100 border-2 border-orange-500 font-bold z-10",
                !committed && isChainStep2 && "bg-purple-100 border-2 border-purple-500 font-bold z-10"
              )}
            >
              {committed ? (
                <CommittedCell entry={committed} role={committedRole!} />
              ) : info && (
                <div className="flex flex-col items-center justify-center leading-tight">
                  <span className="text-[10px] sm:text-[11px] font-bold text-stone-700 truncate w-full block">
                    {truncateSubject(info.subject)}
                  </span>
                  {info.grade !== "?" && info.classNum !== "?" && (
                    <span className="text-[9px] sm:text-[10px] text-swap font-bold bg-swap/10 px-1 py-0.5 rounded mt-0.5 inline-block truncate max-w-full">
                      {info.grade}-{info.classNum}
                    </span>
                  )}
                </div>
              )}
            </td>
          );
        })
      )}
    </tr>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
    <div className="flex-1 min-w-0 bg-white rounded-[14px] border border-stone-200 overflow-hidden">
      <div className="overflow-auto max-h-[75vh] relative">
        <table className="w-full border-collapse text-sm table-fixed">
          <thead ref={theadRef} className="bg-swap text-white sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className="p-2 border-r border-white/20 sticky left-0 z-30 bg-swap w-[85px] whitespace-nowrap overflow-hidden text-ellipsis text-xs sm:text-sm">교사명</th>
              {data.days.map((d) => (
                <th key={d} colSpan={data.periods.length} className="p-2 border border-white/20">{d}</th>
              ))}
            </tr>
            <tr>
              {data.days.map((d) =>
                data.periods.map((p) => (
                  <th key={`${d}-${p}`} className="p-1 border border-white/20 text-[10px]">{p}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {myRow && renderRow(myRow, true)}
            {data.tableData.map((row) => {
              if (row.teacher === myName) return null;

              const isVisible = !selectedCell ||
                                row.teacher === selectedCell.teacher ||
                                results.swap.some(r => r.teacher === row.teacher) ||
                                results.sub.some(r => r.teacher === row.teacher) ||
                                results.chain.some(ch => ch.b.teacher === row.teacher || ch.c.teacher === row.teacher);

              if (!isVisible) return null;

              return renderRow(row, false);
            })}
          </tbody>
        </table>
      </div>
    </div>

      {/* Docked Panel + 보강원 트레이 — 결과 패널을 닫아도 담아둔 건 남아야 하므로 같은 열에 둡니다. */}
      {(modalOpen || tray.entries.length > 0) && (
      <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-24 space-y-4">
      {modalOpen && (
        <div className="bg-white rounded-[14px] border border-stone-200 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-swap p-3 md:p-4 flex justify-between items-center text-white">
            <h2 className="font-display text-base md:text-lg flex items-center gap-2">
              <Search className="w-4 h-4 md:w-5 md:h-5" /> 수업 매칭 결과
            </h2>
            <button
              onClick={() => { setModalOpen(false); setSelectedCell(null); setSelectedChainIdx(null); setQuickPick(null); setPendingDates({}); }}
              className="hover:bg-white/15 p-1 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 md:p-6 max-h-[60vh] overflow-y-auto">
              {/* My Info */}
              <div className="bg-sky-50 p-4 rounded-2xl border-l-4 border-sky-500 mb-6">
                <div className="text-xs text-stone-500 font-medium mb-1">나의 선택 수업</div>
                <div className="text-base font-bold text-stone-800 flex items-center flex-wrap gap-2">
                  {selectedCell?.day}요일 {selectedCell?.period}교시 | {myInfo?.grade}학년 {myInfo?.classNum}반 {myInfo?.subject}
                  {myInfo?.isMovingClass && (
                    <span className="bg-stone-700 text-white px-2 py-0.5 rounded text-xs ml-1">{myInfo.blockGroup}블록</span>
                  )}
                </div>
              </div>

              {selectedCell && isTeacherBlocked(selectedCell.teacher) ? (
                <div className="text-center p-8 text-rose-600 font-bold bg-rose-50 rounded-xl">
                  이 교사는 관리자가 지정한 교체 금지 교사입니다. (교체·대강 모두 불가)
                </div>
              ) : (!myInfo || myInfo.grade === "?" || myInfo.classNum === "?") ? (
                <div className="text-center p-6 text-rose-500 font-bold bg-rose-50 rounded-xl">
                  학반을 특정할 수 없는 수업입니다.
                </div>
              ) : (
                <div className="space-y-6">
                  {myInfo.isMovingClass && (
                    <div>
                      <h3 className="text-sm font-bold text-emerald-600 mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 fill-emerald-600" /> 1순위 추천: 동과 대강 ({data.teacherDepts[selectedCell!.teacher]})
                      </h3>
                      {results.sub.length === 0 ? (
                        <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl">해당 시간에 공강인 동과 선생님이 없습니다.</div>
                      ) : (
                        <div className="space-y-2">
                          {results.sub.map((res, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 border border-emerald-100 bg-emerald-50 rounded-xl">
                              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 font-bold" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-emerald-800 text-sm">{res.teacher} 선생님</div>
                                <div className="text-xs text-stone-600">해당 시간({selectedCell?.day} {selectedCell?.period}교시) <b>공강</b> · 대강 가능</div>
                              </div>
                              {/* 동과 대강은 상대의 수업을 내가 대신 갈 시간이 없어 교체가 성립하지 않습니다. */}
                              {renderPickButtons(res.teacher)}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="border-b border-dashed border-stone-200 my-5"></div>
                      <h3 className="text-sm font-bold text-swap mb-3 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" /> 2순위 추천: 일반 수업 교체
                      </h3>
                    </div>
                  )}

                  {!myInfo.isMovingClass && (
                    <h3 className="text-sm font-bold text-swap mb-3 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4" /> 일반 수업 교체
                    </h3>
                  )}

                  {isSubjectBlocked(myInfo.subject) ? (
                    <div className="text-center p-8 text-rose-600 font-bold bg-rose-50 rounded-xl">
                      &apos;{myInfo.subject}&apos; 과목은 교체가 금지되어 있습니다.
                    </div>
                  ) : results.swap.length === 0 ? (
                    <div className="text-center p-8 text-stone-400 bg-stone-50 rounded-xl">
                      교체 가능한 대상이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.swap.map((res, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border border-stone-100 rounded-xl hover:bg-stone-50 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-swap text-white flex items-center justify-center shrink-0 text-xs font-bold">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-stone-800 text-sm">{res.teacher} 선생님</div>
                            <div className="text-xs text-stone-600"><b>{res.day}요일 {res.period}교시</b> · {res.subject}</div>
                          </div>
                          {renderPickButtons(res.teacher, { day: res.day!, period: res.period!, subject: res.subject! })}
                        </div>
                      ))}
                    </div>
                  )}

                  {results.swap.length === 0 && results.chain.length > 0 && (
                    <div className="mt-2">
                      <div className="border-b border-dashed border-stone-200 mb-5"></div>
                      <h3 className="text-sm font-bold text-purple-600 mb-1 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" /> 2단계 교체 (연쇄 교체)
                      </h3>
                      <p className="text-xs text-stone-500 mb-3">
                        바로 교체할 상대가 없어, 두 번의 교체를 연결하면 가능한 조합을 찾았습니다. 원하는 조합을 선택하세요.
                      </p>
                      <div className="space-y-2">
                        {results.chain.map((ch, i) => (
                          <div
                            key={i}
                            onClick={() => selectChain(i)}
                            className={cn(
                              "p-3 border rounded-xl cursor-pointer transition-colors text-xs text-stone-700 space-y-1",
                              selectedChainIdx === i ? "border-purple-400 bg-purple-50 ring-1 ring-purple-400" : "border-stone-100 hover:bg-stone-50"
                            )}
                          >
                            <div><b className="text-orange-600">1단계</b> {ch.b.teacher} ↔ {ch.c.teacher} 교체 — {ch.c.day}요일 {ch.c.period}교시 {ch.c.subject} ↔ (지금시간) {ch.w.subject}</div>
                            <div><b className="text-purple-700">2단계</b> 나 ↔ {ch.b.teacher} 교체 — {ch.b.day}요일 {ch.b.period}교시 {ch.b.subject}</div>
                          </div>
                        ))}
                      </div>

                      {selectedChainIdx !== null && (
                        <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-stone-500">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> 1단계 이동</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-400 inline-block" /> 2단계 이동</span>
                          <span className="text-stone-400 font-normal">— 아래 시간표에서 확인하세요</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      )}

        <MakeupTray
          entries={tray.entries}
          schoolName={data.schoolName}
          onRemove={tray.remove}
          onClear={tray.clear}
          onDateOverride={tray.setDateOverride}
          baseDate={tray.baseDate}
          onBaseDateChange={tray.setBaseDate}
        />
      </div>
      )}

      {/* 그리드 후보 셀을 직접 눌렀을 때 뜨는 "바로 담기" 팝오버. 판정·담기 로직은
          결과 목록(renderPickButtons)과 완전히 같은 getCandidateState/addToTray를 씁니다 —
          어디서 눌러도 같은 결과가 나와야 하니 로직을 두 번 만들지 않습니다. */}
      {quickPick && (() => {
        const match = results.swap.find(
          (r) => r.teacher === quickPick.teacher && r.day === quickPick.day && r.period === quickPick.period
        );
        if (!match) return null;
        const exchangeSlot = { day: match.day!, period: match.period!, subject: match.subject! };
        const key = candidateKey(quickPick.teacher, exchangeSlot);
        const pending = pendingDates[key];
        const state = getCandidateState(quickPick.teacher, exchangeSlot, pending);
        const swapAvailable = !state.exchangeConflict && !state.absentConflict;
        const subAvailable = !state.absentConflict;
        const setPending = (patch: Partial<PendingDates>) =>
          setPendingDates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
        // 화면 위쪽 가까이 있으면 셀 아래로, 아니면 위로 띄워서 뷰포트 밖으로 안 나가게 합니다.
        // innerWidth가 0/비정상이면(레이아웃 계산 전 등) 폭을 못 구해 팝오버가 화면 밖으로
        // 튕겨 나가므로, 그럴 땐 그냥 넉넉한 값으로 대체합니다. 겹침일 때 날짜 입력칸이
        // 들어가야 해서 기존 180px보다 조금 넓게(208px) 잡습니다.
        const openBelow = quickPick.rect.top < 180;
        const viewportWidth = window.innerWidth > 0 ? window.innerWidth : 1280;
        const left = Math.min(Math.max(quickPick.rect.left + quickPick.rect.width / 2 - 104, 8), viewportWidth - 216);

        return (
          <div
            ref={quickPickRef}
            className="fixed z-50 w-[208px] bg-white rounded-xl border border-stone-200 shadow-xl p-2.5 animate-in fade-in zoom-in-95 duration-100"
            style={{
              left,
              top: openBelow ? quickPick.rect.top + quickPick.rect.height + 6 : quickPick.rect.top - 6,
              transform: openBelow ? undefined : "translateY(-100%)",
            }}
          >
            <p className="text-[11px] font-bold text-stone-500 mb-1.5 truncate">{quickPick.teacher} 선생님과</p>
            {state.picked ? (
              <p className="text-[11px] font-bold text-amber-700">
                이미 {state.picked.kind === "swap" ? "교체" : "보강"}로 담겨 있습니다.
              </p>
            ) : (
              <div className="space-y-1.5">
                {state.absentConflict && (
                  <label className="block text-[10px] font-bold text-rose-500" title={state.absentTitle}>
                    겹침 · 결강일
                    <input
                      type="date"
                      value={pending?.absentDateOverride ?? state.absentDate}
                      onChange={(e) => setPending({ absentDateOverride: e.target.value })}
                      className="mt-0.5 w-full border border-rose-200 rounded px-1.5 py-1 text-[11px] font-normal text-stone-700"
                    />
                  </label>
                )}
                {state.exchangeConflict && (
                  <label className="block text-[10px] font-bold text-rose-500" title={state.exchangeTitle}>
                    겹침 · 교체일
                    <input
                      type="date"
                      value={pending?.exchangeDateOverride ?? state.exchangeDate}
                      onChange={(e) => setPending({ exchangeDateOverride: e.target.value })}
                      className="mt-0.5 w-full border border-rose-200 rounded px-1.5 py-1 text-[11px] font-normal text-stone-700"
                    />
                  </label>
                )}
                <div className="flex gap-1.5">
                  <button
                    disabled={!swapAvailable}
                    onClick={() => {
                      addToTray("swap", quickPick.teacher, exchangeSlot, pending);
                      setQuickPick(null);
                    }}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-opacity",
                      swapAvailable ? "bg-swap hover:opacity-90 text-white" : "bg-stone-100 text-stone-300 cursor-not-allowed"
                    )}
                  >
                    <FilePlus2 className="w-3 h-3" /> 교체
                  </button>
                  <button
                    disabled={!subAvailable}
                    onClick={() => {
                      addToTray("sub", quickPick.teacher, undefined, pending);
                      setQuickPick(null);
                    }}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-colors",
                      subAvailable ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-stone-100 text-stone-300 cursor-not-allowed"
                    )}
                  >
                    <FilePlus2 className="w-3 h-3" /> 보강
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
