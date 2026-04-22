import React, { useState, useRef, useEffect } from "react";
import { Settings2, Check, RotateCcw } from "lucide-react";

// --- ソートオプション定義 ---
export interface SortOption {
  value: string;
  label: string;
  group: string;
}

export const TIMELINE_SORT_OPTIONS: SortOption[] = [
  // 日付・期日
  { value: "deliveryDate", label: "📅 納入日が早い順", group: "日付・期日" },
  { value: "deliveryDateDesc", label: "📅 納入日が遅い順", group: "日付・期日" },
  { value: "nearestDeadline", label: "⏰ タスク期限が近い順", group: "日付・期日" },
  { value: "createdAtDesc", label: "🆕 登録が新しい順", group: "日付・期日" },
  { value: "createdAtAsc", label: "🗂 登録が古い順", group: "日付・期日" },
  // タスク状況
  { value: "overdueFirst", label: "🔴 期限切れタスクが多い順", group: "タスク状況" },
  { value: "urgentFirst", label: "⚠️ 緊急タスクが多い順", group: "タスク状況" },
  { value: "uncompletedFirst", label: "📋 未完了タスクが多い順", group: "タスク状況" },
  { value: "progress", label: "📉 進捗が低い順", group: "タスク状況" },
  { value: "progressDesc", label: "📈 進捗が高い順", group: "タスク状況" },
  // 名前順
  { value: "machineNumber", label: "🔢 機番順", group: "名前順" },
  { value: "projectName", label: "🏗 工事名順", group: "名前順" },
  { value: "customer", label: "🏢 顧客名順", group: "名前順" },
];

export const ALL_SORT_VALUES = TIMELINE_SORT_OPTIONS.map((o) => o.value);

export interface TimelineSortSettings {
  defaultSort: string;
  visibleSorts: string[];
}

export const DEFAULT_SORT_SETTINGS: TimelineSortSettings = {
  defaultSort: "deliveryDate",
  visibleSorts: ["deliveryDate", "nearestDeadline", "progress", "machineNumber", "customer"],
};

interface Project {
  id: string;
  machineNumber: string;
  projectName: string;
  customer?: string;
  deliveryDate?: string;
  status: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  deadline?: string;
  completed: boolean;
  createdAt?: number;
  priority?: string;
}

interface GanttTimelineProps {
  projects: Project[];
  tasks: Task[];
  timelineSortMode: string;
  setTimelineSortMode: (mode: string) => void;
  calculateProgress: (projectId: string) => number;
  getDeadlineStatus: (deadline: string | undefined, completed: boolean) => string;
  sortSettings: TimelineSortSettings;
  setSortSettings: (settings: TimelineSortSettings) => void;
  onTaskClick?: (projectId: string, taskId: string) => void;
  onTaskDeadlineChange?: (taskId: string, newDateStr: string) => void;
}

export default function GanttTimeline({
  projects,
  tasks,
  timelineSortMode,
  setTimelineSortMode,
  calculateProgress,
  getDeadlineStatus,
  sortSettings,
  setSortSettings,
  onTaskClick,
  onTaskDeadlineChange,
}: GanttTimelineProps) {
  const [showSortSettings, setShowSortSettings] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayXRef = useRef(0);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
  const [viewInterval, setViewInterval] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("atask-timeline-view-interval");
      if (saved) return saved;
    } catch {}
    return "auto";
  });

  React.useEffect(() => {
    try {
      localStorage.setItem("atask-timeline-view-interval", viewInterval);
    } catch {}
  }, [viewInterval]);

  // 表示するソートオプション（設定でフィルタ）
  const visibleOptions = TIMELINE_SORT_OPTIONS.filter((o) =>
    sortSettings.visibleSorts.includes(o.value)
  );
  const groups = [...new Set(visibleOptions.map((o) => o.group))];
  const activeProjects = projects.filter((p) => p.status !== "Completed");

  // ---- Sort helpers ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const countOverdue = (projectId: string) =>
    tasks.filter((t) => {
      if (t.projectId !== projectId || t.completed || !t.deadline) return false;
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      return d.getTime() < today.getTime();
    }).length;

  const countUrgent = (projectId: string) =>
    tasks.filter((t) => {
      if (t.projectId !== projectId || t.completed || !t.deadline) return false;
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 3;
    }).length;

  const countUncompleted = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && !t.completed).length;

  const getProjectMaxPriority = (projectId: string) => {
    const uncompletedTasks = tasks.filter((t) => t.projectId === projectId && !t.completed);
    const pWeight = { High: 3, Medium: 2, Low: 1 };
    let max = 0;
    uncompletedTasks.forEach(t => {
      const w = pWeight[t.priority as keyof typeof pWeight] || 0;
      if (w > max) max = w;
    });
    return max;
  };

  // Sort projects
  const sortedProjects = [...activeProjects].sort((a, b) => {
    const pa = calculateProgress(a.id);
    const pb = calculateProgress(b.id);
    const ta = tasks.filter((t) => t.projectId === a.id);
    const tb = tasks.filter((t) => t.projectId === b.id);
    const na = ta.filter((t) => !t.completed && t.deadline)
      .sort((x, y) => new Date(x.deadline!).getTime() - new Date(y.deadline!).getTime())[0]?.deadline;
    const nb = tb.filter((t) => !t.completed && t.deadline)
      .sort((x, y) => new Date(x.deadline!).getTime() - new Date(y.deadline!).getTime())[0]?.deadline;

    let primaryDiff = 0;
    switch (timelineSortMode) {
      // ---- 日付系 ----
      case "deliveryDate":
        primaryDiff = (a.deliveryDate ? new Date(a.deliveryDate).getTime() : 9e15)
          - (b.deliveryDate ? new Date(b.deliveryDate).getTime() : 9e15);
        break;
      case "deliveryDateDesc":
        primaryDiff = (b.deliveryDate ? new Date(b.deliveryDate).getTime() : -9e15)
          - (a.deliveryDate ? new Date(a.deliveryDate).getTime() : -9e15);
        break;
      case "nearestDeadline":
        primaryDiff = (na ? new Date(na).getTime() : 9e15) - (nb ? new Date(nb).getTime() : 9e15);
        break;
      case "createdAtDesc":
        primaryDiff = ((b as any).createdAt ?? 0) - ((a as any).createdAt ?? 0);
        break;
      case "createdAtAsc":
        primaryDiff = ((a as any).createdAt ?? 0) - ((b as any).createdAt ?? 0);
        break;
      // ---- タスク状況系 ----
      case "overdueFirst":
        primaryDiff = countOverdue(b.id) - countOverdue(a.id);
        break;
      case "urgentFirst":
        primaryDiff = countUrgent(b.id) - countUrgent(a.id);
        break;
      case "uncompletedFirst":
        primaryDiff = countUncompleted(b.id) - countUncompleted(a.id);
        break;
      case "progress":
        primaryDiff = pa - pb;
        break;
      case "progressDesc":
        primaryDiff = pb - pa;
        break;
      // ---- 名前系 ----
      case "machineNumber":
        primaryDiff = (a.machineNumber || "").localeCompare(b.machineNumber || "", "ja");
        break;
      case "projectName":
        primaryDiff = (a.projectName || "").localeCompare(b.projectName || "", "ja");
        break;
      case "customer":
        primaryDiff = (a.customer || "").localeCompare(b.customer || "", "ja");
        break;
      default:
        primaryDiff = 0;
        break;
    }
    if (primaryDiff !== 0) return primaryDiff;

    return getProjectMaxPriority(b.id) - getProjectMaxPriority(a.id);
  });

  // ---- Gantt chart date range ----

  const activeProjectIds = new Set(activeProjects.map((p) => p.id));
  const activeTasks = tasks.filter((t) => activeProjectIds.has(t.projectId));

  const validDates: number[] = [];
  activeTasks.forEach((t) => {
    if (t.deadline) {
      const d = new Date(t.deadline).getTime();
      if (!isNaN(d)) validDates.push(d);
    }
    // createdAt は範囲計算に含めない（バー描画には使用するが、古い日付で範囲が広がるのを防ぐ）
  });
  activeProjects.forEach((p) => {
    if (p.deliveryDate) {
      const d = new Date(p.deliveryDate).getTime();
      if (!isNaN(d)) validDates.push(d);
    }
  });

  let chartStart = new Date(today);
  let chartEnd = new Date(today);
  let PX_PER_DAY = 16;

  if (viewInterval === "auto") {
    chartStart.setDate(chartStart.getDate() - 21);
    chartEnd.setDate(chartEnd.getDate() + 60);
    if (validDates.length > 0) {
      const minD = new Date(Math.min(...validDates));
      const maxD = new Date(Math.max(...validDates));
      
      // 極端な日付（入力ミス等）によるスクロールバーの肥大化を防ぐため、auto時の最大範囲を制限
      const maxPast = new Date(today);
      maxPast.setMonth(maxPast.getMonth() - 6); // 過去は最大6ヶ月まで
      const maxFuture = new Date(today);
      maxFuture.setFullYear(maxFuture.getFullYear() + 1); // 未来は最大1年まで

      const boundedMin = new Date(Math.max(minD.getTime(), maxPast.getTime()));
      const boundedMax = new Date(Math.min(maxD.getTime(), maxFuture.getTime()));

      if (boundedMin.getTime() < chartStart.getTime()) {
        chartStart = new Date(boundedMin);
        chartStart.setDate(chartStart.getDate() - 7);
      }
      if (boundedMax.getTime() > chartEnd.getTime()) {
        chartEnd = new Date(boundedMax);
        chartEnd.setDate(chartEnd.getDate() + 14);
      }
    }
    
    // 表示期間に応じて横幅が約1000pxに収まるようにPX_PER_DAYを逆算する
    const tempTotalDays = Math.ceil((chartEnd.getTime() - chartStart.getTime()) / (1000 * 60 * 60 * 24));
    let calcPx = 1000 / tempTotalDays;
    if (calcPx > 16) calcPx = 16;
    if (calcPx < 1.5) calcPx = 1.5;
    PX_PER_DAY = calcPx;
  } else if (viewInterval === "1week") {
    chartStart.setDate(chartStart.getDate() - 2);
    chartEnd.setDate(chartEnd.getDate() + 7);
    PX_PER_DAY = 60;
  } else if (viewInterval === "1month") {
    chartStart.setDate(chartStart.getDate() - 7);
    chartEnd.setDate(chartEnd.getDate() + 31);
    PX_PER_DAY = 30;
  } else if (viewInterval === "3months") {
    chartStart.setDate(chartStart.getDate() - 14);
    chartEnd.setDate(chartEnd.getDate() + 90);
    PX_PER_DAY = 16;
  } else if (viewInterval === "6months") {
    chartStart.setDate(chartStart.getDate() - 30);
    chartEnd.setDate(chartEnd.getDate() + 180);
    PX_PER_DAY = 10;
  } else if (viewInterval === "1year") {
    chartStart.setDate(chartStart.getDate() - 30);
    chartEnd.setDate(chartEnd.getDate() + 365);
    PX_PER_DAY = 5;
  } else if (viewInterval === "2years") {
    chartStart.setDate(chartStart.getDate() - 60);
    chartEnd.setDate(chartEnd.getDate() + 730);
    PX_PER_DAY = 3;
  }

  const totalMs = chartEnd.getTime() - chartStart.getTime();
  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
  const CHART_WIDTH = totalDays * PX_PER_DAY;
  const LEFT_COL = 180;

  const dateToX = (d: Date | string): number => {
    const date = typeof d === "string" ? new Date(d) : new Date(d);
    date.setHours(0, 0, 0, 0);
    return Math.max(0, ((date.getTime() - chartStart.getTime()) / totalMs) * CHART_WIDTH);
  };

  const xToDate = (x: number): string => {
    const ms = (x / CHART_WIDTH) * totalMs;
    const d = new Date(chartStart.getTime() + ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handlePointerDown = (e: React.PointerEvent, taskId: string, initialX: number) => {
    if (!onTaskDeadlineChange) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraggingTaskId(taskId);
    setDragCurrentX(initialX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingTaskId !== null && dragCurrentX !== null) {
      setDragCurrentX((prev) => Math.max(0, Math.min(CHART_WIDTH, (prev as number) + e.movementX)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent, taskId: string) => {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    if (draggingTaskId === taskId && dragCurrentX !== null && onTaskDeadlineChange) {
      const newDateStr = xToDate(dragCurrentX);
      onTaskDeadlineChange(taskId, newDateStr);
      setDraggingTaskId(null);
      setDragCurrentX(null);
    }
  };

  const todayX = dateToX(today);
  todayXRef.current = todayX;

  // viewInterval 変更時（および初回マウント時）に今日の位置へ自動スクロール
  useEffect(() => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollLeft = Math.max(0, todayXRef.current - containerWidth / 4);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewInterval]);

  // Month labels
  const monthLabels: { label: string; x: number }[] = [];
  const mDate = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
  while (mDate <= chartEnd) {
    const x = dateToX(mDate);
    if (x >= 0) {
      monthLabels.push({
        label: `${mDate.getFullYear()}年${mDate.getMonth() + 1}月`,
        x,
      });
    }
    mDate.setMonth(mDate.getMonth() + 1);
  }

  // Week labels (every 7 days starting from nearest Monday)
  const weekLabels: { label: string; x: number }[] = [];
  const wDate = new Date(chartStart);
  wDate.setDate(wDate.getDate() + ((8 - wDate.getDay()) % 7));
  while (wDate <= chartEnd) {
    weekLabels.push({
      label: `${wDate.getMonth() + 1}/${wDate.getDate()}`,
      x: dateToX(wDate),
    });
    wDate.setDate(wDate.getDate() + 7);
  }

  // Weekends
  const weekendBackgrounds: { x: number; isSaturday: boolean }[] = [];
  const dWeekend = new Date(chartStart);
  dWeekend.setHours(0, 0, 0, 0);
  while (dWeekend <= chartEnd) {
    const day = dWeekend.getDay();
    if (day === 0 || day === 6) {
      weekendBackgrounds.push({
        x: dateToX(dWeekend),
        isSaturday: day === 6,
      });
    }
    dWeekend.setDate(dWeekend.getDate() + 1);
  }

  const getBarColors = (deadline: string | undefined, completed: boolean) => {
    if (completed) return { bar: "bg-gray-300", marker: "bg-gray-400", label: "text-gray-400" };
    const s = getDeadlineStatus(deadline, completed);
    if (s === "overdue") return { bar: "bg-red-300", marker: "bg-red-500", label: "text-red-600" };
    if (s === "urgent") return { bar: "bg-amber-300", marker: "bg-amber-500", label: "text-amber-700" };
    return { bar: "bg-emerald-300", marker: "bg-emerald-500", label: "text-emerald-700" };
  };

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              タイムライン
            </h2>
            <p className="text-xs text-gray-500 hidden sm:block">全プロジェクトの Gantt チャート</p>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] flex-shrink-0">
            {[
              { c: "bg-emerald-500", l: "通常" },
              { c: "bg-amber-500", l: "3日以内" },
              { c: "bg-red-500", l: "期限切れ" },
              { c: "bg-gray-400", l: "完了" },
            ].map(({ c, l }) => (
              <div key={l} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${c}`} />
                <span className="text-gray-500">{l}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-0.5 h-3 bg-red-400" />
              <span className="text-gray-500">TODAY</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rotate-45 bg-teal-600" />
              <span className="text-gray-500">納入日</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm">
            <span className="text-gray-500 font-medium whitespace-nowrap">表示期間:</span>
            <select
              value={viewInterval}
              onChange={(e) => setViewInterval(e.target.value)}
              className="border-0 bg-transparent focus:outline-none font-semibold text-emerald-700 cursor-pointer"
            >
              <option value="auto">自動 (全体)</option>
              <option value="1week">1週間</option>
              <option value="1month">1か月</option>
              <option value="3months">3か月</option>
              <option value="6months">6か月</option>
              <option value="1year">1年</option>
              <option value="2years">2年</option>
            </select>
          </div>
          <div className="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm">
            <span className="text-gray-500 font-medium whitespace-nowrap">並び順:</span>
            <select
              value={timelineSortMode}
              onChange={(e) => setTimelineSortMode(e.target.value)}
              className="border-0 bg-transparent focus:outline-none font-semibold text-emerald-700 cursor-pointer"
            >
              {groups.map((group) => (
                <optgroup key={group} label={`── ${group} ──`}>
                  {visibleOptions
                    .filter((o) => o.group === group)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowSortSettings(!showSortSettings)}
            className={`p-1.5 rounded-md border transition-colors ${
              showSortSettings
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-gray-200 text-gray-500 hover:text-emerald-600 hover:border-emerald-200"
            }`}
            title="ソート設定"
          >
            <Settings2 size={14} />
          </button>
        </div>
      </header>

      {/* Sort Settings Panel */}
      {showSortSettings && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">ソート設定</h3>
            <button
              onClick={() => {
                setSortSettings(DEFAULT_SORT_SETTINGS);
                setTimelineSortMode(DEFAULT_SORT_SETTINGS.defaultSort);
              }}
              className="text-[10px] md:text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1"
            >
              <RotateCcw size={12} /> 初期値に戻す
            </button>
          </div>

          {/* デフォルトソート */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              デフォルトの並び順
            </label>
            <select
              value={sortSettings.defaultSort}
              onChange={(e) => {
                setSortSettings({ ...sortSettings, defaultSort: e.target.value });
              }}
              className="text-xs md:text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-emerald-500 font-medium text-gray-700 w-full max-w-xs"
            >
              {sortSettings.visibleSorts.map((val) => {
                const opt = TIMELINE_SORT_OPTIONS.find((o) => o.value === val);
                return opt ? (
                  <option key={val} value={val}>
                    {opt.label}
                  </option>
                ) : null;
              })}
            </select>
          </div>

          {/* 表示するソート項目 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              表示するソート項目
            </label>
            {["日付・期日", "タスク状況", "名前順"].map((group) => (
              <div key={group} className="mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {group}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TIMELINE_SORT_OPTIONS.filter((o) => o.group === group).map((opt) => {
                    const isVisible = sortSettings.visibleSorts.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          let newVisible: string[];
                          if (isVisible) {
                            // 最低1つは残す
                            if (sortSettings.visibleSorts.length <= 1) return;
                            newVisible = sortSettings.visibleSorts.filter((v) => v !== opt.value);
                            // デフォルトが消えたら先頭に変更
                            const newDefault = newVisible.includes(sortSettings.defaultSort)
                              ? sortSettings.defaultSort
                              : newVisible[0];
                            setSortSettings({ defaultSort: newDefault, visibleSorts: newVisible });
                            if (timelineSortMode === opt.value) setTimelineSortMode(newDefault);
                          } else {
                            newVisible = [...sortSettings.visibleSorts, opt.value];
                            setSortSettings({ ...sortSettings, visibleSorts: newVisible });
                          }
                        }}
                        className={`text-[10px] md:text-xs px-2 py-1 rounded-full border flex items-center gap-1 transition-colors ${
                          isVisible
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-gray-50 border-gray-200 text-gray-400"
                        }`}
                      >
                        {isVisible && <Check size={10} />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend removed and integrated into Header */}

      {/* Gantt chart body */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col min-h-0">
        {activeProjects.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            進行中のプロジェクトはありません。
          </div>
        ) : (
          <div ref={scrollContainerRef} className="overflow-auto flex-1">
            <div style={{ minWidth: LEFT_COL + CHART_WIDTH }} className="relative">

              {/* Grid overlay — rendered ONCE for the entire chart */}
              <div
                className="absolute pointer-events-none"
                style={{ left: LEFT_COL, top: 0, width: CHART_WIDTH, bottom: 0 }}
              >
                {PX_PER_DAY >= 5 && weekendBackgrounds.map((wb, i) => (
                  <div
                    key={`we-${i}`}
                    className="absolute top-0 bottom-0 bg-gray-200/50"
                    style={{ left: wb.x, width: PX_PER_DAY }}
                  />
                ))}
                {PX_PER_DAY >= 5 && weekLabels.map((wl, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-gray-100"
                    style={{ left: wl.x }}
                  />
                ))}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-200/60 z-10"
                  style={{ left: todayX }}
                />
              </div>

              {/* Sticky date-axis header row */}
              <div className="flex sticky top-0 z-30 bg-gray-50 border-b-2 border-gray-300 shadow-sm">
                <div
                  style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                  className="flex-shrink-0 sticky left-0 z-40 bg-gray-50 border-r-2 border-gray-300 h-10 flex items-end px-2 pb-1"
                >
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    工事 / タスク
                  </span>
                </div>
                <div
                  style={{ width: CHART_WIDTH, minWidth: CHART_WIDTH }}
                  className="flex-shrink-0 h-10 relative"
                >
                  {monthLabels.map((ml, i) => (
                    <div
                      key={i}
                      className="absolute top-0 text-xs font-bold text-gray-700 whitespace-nowrap px-2 pt-1 border-l-2 border-gray-300 h-full"
                      style={{ left: ml.x }}
                    >
                      {PX_PER_DAY < 3 ? ml.label.replace(/.*年/, "") : ml.label}
                    </div>
                  ))}
                  {PX_PER_DAY >= 5 && weekLabels.map((wl, i) => (
                    <div
                      key={i}
                      className="absolute bottom-0.5 text-[9px] text-gray-400 whitespace-nowrap"
                      style={{ left: wl.x, transform: "translateX(-50%)" }}
                    >
                      {wl.label}
                    </div>
                  ))}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: todayX }}
                  >
                    <span className="absolute top-0 left-1 text-[8px] text-red-500 font-bold leading-none mt-0.5">
                      TODAY
                    </span>
                  </div>
                </div>
              </div>

              {/* Project groups */}
              {sortedProjects.map((project) => {
                const progress = calculateProgress(project.id);
                const projectTasks = tasks
                  .filter((t) => t.projectId === project.id)
                  .sort((a, b) => {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    const pWeight = { High: 3, Medium: 2, Low: 1 };
                    const pwA = pWeight[a.priority as keyof typeof pWeight] || 0;
                    const pwB = pWeight[b.priority as keyof typeof pWeight] || 0;
                    if (pwA !== pwB) return pwB - pwA;
                    return (
                      (a.deadline ? new Date(a.deadline).getTime() : 9e15) -
                      (b.deadline ? new Date(b.deadline).getTime() : 9e15)
                    );
                  });

                return (
                  <div key={project.id} className="border-b-2 border-gray-200">
                    {/* Project header row */}
                    <div className="flex bg-emerald-50/80 border-b border-emerald-200">
                      <div
                        style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                        className="flex-shrink-0 sticky left-0 z-20 bg-emerald-50 border-r border-emerald-200 px-2 py-1.5"
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[9px] font-bold text-emerald-800 bg-white border border-emerald-300 px-1 py-0.5 rounded leading-none">
                            {project.machineNumber}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-700 leading-none ml-auto">{progress}%</span>
                        </div>
                        <p
                          className={`text-xs font-semibold text-gray-800 truncate leading-tight ${onTaskClick ? "cursor-pointer hover:text-emerald-600" : ""}`}
                          onClick={() => onTaskClick?.(project.id, "")}
                        >
                          {project.projectName}
                        </p>
                        <div className="flex items-center mt-1">
                          <div className="flex-1 bg-white rounded-full h-1 border border-emerald-200">
                            <div
                              className={`h-1 rounded-full ${
                                progress === 100 ? "bg-emerald-500" : "bg-teal-400"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div
                        style={{ width: CHART_WIDTH, minWidth: CHART_WIDTH, height: 44 }}
                        className="flex-shrink-0 relative"
                      >
                        {project.deliveryDate && (
                          <div
                            className="absolute flex flex-col items-center z-20"
                            style={{
                              left: dateToX(project.deliveryDate),
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <div className="w-3 h-3 rotate-45 bg-teal-600 border-2 border-white shadow-sm" />
                            <span className="text-[8px] text-teal-800 font-bold whitespace-nowrap mt-0.5 bg-white/90 px-1 rounded shadow-sm leading-none">
                              {project.deliveryDate.slice(5)}
                            </span>
                          </div>
                        )}
                        {project.customer && (
                          <div className="absolute left-2 bottom-0.5 text-[8px] text-emerald-600 font-medium">
                            {project.customer}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Task rows */}
                    {projectTasks.length === 0 ? (
                      <div className="flex border-b border-gray-100">
                        <div
                          style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                          className="flex-shrink-0 sticky left-0 bg-white border-r border-gray-100 px-2 h-6 flex items-center text-xs text-gray-300 italic"
                        >
                          タスクなし
                        </div>
                        <div style={{ width: CHART_WIDTH, minWidth: CHART_WIDTH, height: 24 }} className="flex-shrink-0" />
                      </div>
                    ) : (
                      projectTasks.map((task) => {
                        const colors = getBarColors(task.deadline, task.completed);
                        const taskX = task.deadline ? dateToX(task.deadline) : null;
                        const startX = task.createdAt ? dateToX(new Date(task.createdAt)) : 0;
                        const isDragging = draggingTaskId === task.id;
                        const displayX = isDragging && dragCurrentX !== null ? dragCurrentX : taskX;

                        return (
                          <div
                            key={task.id}
                            className="flex border-b border-gray-100 hover:bg-gray-50/50"
                          >
                            <div
                              style={{ width: LEFT_COL, minWidth: LEFT_COL }}
                              className={`flex-shrink-0 sticky left-0 z-10 border-r border-gray-100 px-2 h-7 flex items-center gap-1.5 ${
                                task.completed ? "bg-gray-50" : "bg-white"
                              }`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full flex-shrink-0 ${
                                  task.completed ? "bg-emerald-400" : "bg-gray-300"
                                }`}
                              />
                              <span
                                className={`text-[11px] truncate ${
                                  task.completed
                                    ? "line-through text-gray-400"
                                    : "text-gray-700 hover:text-emerald-600"
                                } ${onTaskClick ? "cursor-pointer" : ""}`}
                                onClick={() => onTaskClick?.(project.id, task.id)}
                              >
                                {task.title}
                              </span>
                            </div>
                            <div
                              style={{ width: CHART_WIDTH, minWidth: CHART_WIDTH, height: 28 }}
                              className="flex-shrink-0 relative"
                            >
                              {displayX !== null ? (
                                <>
                                  <div
                                    className={`absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full opacity-75 ${colors.bar}`}
                                    style={{ left: startX, width: Math.max(0, displayX - startX) }}
                                  />
                                  <div
                                    className={`absolute w-3.5 h-3.5 border-2 border-white shadow-sm z-20 cursor-ew-resize transition-transform ${isDragging ? 'scale-125' : ''} ${colors.marker}`}
                                    style={{
                                      left: displayX,
                                      top: "50%",
                                      transform: "translate(-50%, -50%) rotate(45deg)",
                                      touchAction: "none"
                                    }}
                                    onPointerDown={(e) => handlePointerDown(e, task.id, displayX)}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={(e) => handlePointerUp(e, task.id)}
                                    onPointerCancel={(e) => handlePointerUp(e, task.id)}
                                  />
                                  <div
                                    className={`absolute top-1/2 -translate-y-1/2 z-20 text-[8px] font-semibold whitespace-nowrap pl-2 pointer-events-none ${colors.label}`}
                                    style={{ left: displayX }}
                                  >
                                    {isDragging && dragCurrentX !== null ? xToDate(dragCurrentX).slice(5) : task.deadline?.slice(5)}
                                  </div>
                                </>
                              ) : (
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 italic">
                                  期限未設定
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
