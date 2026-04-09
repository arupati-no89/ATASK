import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  Trash2,
  Layout,
  ListTodo,
  FileInput,
  Settings,
  Users,
  Hash,
  Briefcase,
  Sparkles,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  CheckSquare,
  Square,
  Save,
  HardDrive,
  Archive,
  RefreshCw,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  ExternalLink,
  Copy,
  Share2,
  Printer,
  CalendarDays,
  ClipboardCopy,
  Cloud,
  AlertCircle,
  Menu,
  ArrowLeft,
  ChevronLeft,
  Pencil,
  FileText,
  Lock,
} from "lucide-react";

// Firebase Imports
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  writeBatch,
} from "firebase/firestore";

// --- アプリのパスワード設定 ---
const APP_PASSWORD = "atask";

// --- クリックで直接編集できるインラインコンポーネント ---
const InlineEdit = ({
  value,
  onSave,
  type = "text",
  className = "",
  textClassName = "",
  allowEdit = true,
  placeholderText = "",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || "");

  useEffect(() => {
    setTempValue(value || "");
  }, [value]);

  const handleKeyDown = (e) => {
    if (type === "textarea") return; // textareaの場合はEnterで保存せず改行させる
    if (e.key === "Enter") {
      if (type === "text" && tempValue.trim() === "") {
        setTempValue(value || "");
      } else if (tempValue !== value) {
        onSave(tempValue);
      }
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setTempValue(value || "");
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if ((type === "text" || type === "textarea") && tempValue.trim() === "") {
      setTempValue(value || "");
      if (tempValue !== value) onSave("");
    } else if (tempValue !== value) {
      onSave(tempValue);
    }
    setIsEditing(false);
  };

  const displayValue = value || placeholderText || (type === "date" ? "-" : "");

  if (!allowEdit) {
    return (
      <span
        className={`${textClassName} ${
          type === "textarea" ? "whitespace-pre-wrap" : ""
        }`}
      >
        {displayValue}
      </span>
    );
  }

  if (isEditing) {
    if (type === "textarea") {
      return (
        <textarea
          autoFocus
          className={`border border-emerald-300 bg-emerald-50 outline-none text-black px-2 py-1 rounded w-full resize-y min-h-[60px] ${className}`}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <input
        autoFocus
        type={type}
        className={`border-b-2 border-emerald-500 bg-emerald-50 outline-none text-black px-1 py-0 ${className}`}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={`group inline-flex items-start gap-1 relative ${
        type === "textarea" ? "w-full" : ""
      }`}
    >
      <span
        className={`${textClassName} ${
          type === "textarea" ? "whitespace-pre-wrap block w-full" : ""
        }`}
      >
        {displayValue}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className={`opacity-50 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-emerald-600 transition-opacity p-1 rounded focus:outline-none ${
          type === "textarea" ? "mt-[-4px]" : ""
        }`}
        title="編集"
      >
        <Pencil size={14} />
      </button>
    </span>
  );
};

export default function App() {
  // --- Password Lock State ---
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- Firebase Configuration & Initialization ---
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [appId, setAppId] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    try {
      let configToUse;
      if (typeof __firebase_config !== "undefined") {
        configToUse = JSON.parse(__firebase_config);
      } else {
        // ====================================================================
        // 【重要】ここをご自身のFirebaseプロジェクトの設定情報に書き換えてください
        // ====================================================================
        configToUse = {
          apiKey: "AIzaSyANCgmNfP06SEncfZ5yzwIshnNAjruGpUs",
          authDomain: "atask-app-a72da.firebaseapp.com",
          projectId: "atask-app-a72da",
          storageBucket: "atask-app-a72da.firebasestorage.app",
          messagingSenderId: "521595866336",
          appId: "1:521595866336:web:07a04aab83a09137449485",
        };
        // ====================================================================
      }

      if (
        !configToUse ||
        !configToUse.apiKey ||
        configToUse.apiKey === "YOUR_API_KEY"
      ) {
        setAuthError(
          "コード内の firebaseConfig をご自身のFirebase設定に書き換えてください。"
        );
        return;
      }

      const app = initializeApp(configToUse);
      const auth = getAuth(app);
      const firestore = getFirestore(app);
      setDb(firestore);

      const currentAppId =
        typeof __app_id !== "undefined" ? __app_id : "my-a-task-app";
      setAppId(currentAppId);

      const initAuth = async () => {
        try {
          if (
            typeof __initial_auth_token !== "undefined" &&
            __initial_auth_token
          ) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Auth Error:", error);
          setAuthError(
            "認証に失敗しました。Firebaseの設定を確認してください。"
          );
        }
      };
      initAuth();

      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase Init Error:", err);
      setAuthError("データベース接続エラーが発生しました。");
    }
  }, []);

  // --- State Management (Firestore Synced) ---
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [subTasks, setSubTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!db || !appId || !user) return;

    setLoading(true);

    const projectsPath = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "projects"
    );
    const tasksPath = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "tasks"
    );
    const subTasksPath = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "subTasks"
    );

    const unsubProjects = onSnapshot(
      query(projectsPath),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProjects(data.sort((a, b) => b.createdAt - a.createdAt));
      },
      (error) => console.error("Projects Sync Error:", error)
    );

    const unsubTasks = onSnapshot(
      query(tasksPath),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTasks(data);
      },
      (error) => console.error("Tasks Sync Error:", error)
    );

    const unsubSubTasks = onSnapshot(
      query(subTasksPath),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSubTasks(data);
        setLoading(false);
      },
      (error) => console.error("SubTasks Sync Error:", error)
    );

    return () => {
      unsubProjects();
      unsubTasks();
      unsubSubTasks();
    };
  }, [db, appId, user]);

  // UI States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSubTaskSuggestions, setShowSubTaskSuggestions] = useState({});
  const [expandedTaskIds, setExpandedTaskIds] = useState([]);
  const [dashboardSortMode, setDashboardSortMode] = useState("deadline"); // "deadline", "deliveryDate", "machineNumber"
  const [taskSortMode, setTaskSortMode] = useState("deadline"); // "deadline", "createdAt"

  // Form States
  const [newProject, setNewProject] = useState({
    machineNumber: "",
    projectName: "",
    customer: "",
    deliveryDate: "",
  });
  const [newTask, setNewTask] = useState({
    title: "",
    deadline: "",
    priority: "Medium",
  });
  const [newSubTaskTitles, setNewSubTaskTitles] = useState({});
  const [attachmentMode, setAttachmentMode] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  // --- Mock Knowledge Base (AI提案ロジック) ---
  const taskTemplates = {
    増設: [
      "現場レイアウト確認",
      "ケーブルルートの設計",
      "電源容量の計算",
      "追加機器の選定",
      "搬入経路の確認",
      "試運転調整リスト作成",
    ],
    リプレース: [
      "既設盤の調査",
      "新旧回路の照合",
      "撤去計画の立案",
      "仮設電源の準備",
      "交換手順書の作成",
      "廃材処理の手配",
    ],
    点検: [
      "点検項目のリストアップ",
      "測定器の校正確認",
      "点検記録簿の準備",
      "不具合箇所の写真撮影",
    ],
    工事: [
      "安全書類の作成",
      "工事工程表の作成",
      "作業員手配",
      "立会検査の依頼",
    ],
    default: [
      "注文書の受領確認",
      "見積書の作成",
      "客先打ち合わせ",
      "完了報告書の提出",
      "請求処理",
    ],
  };

  const subTaskTemplates = {
    作成: ["フォーマット確認", "下書き作成", "上長承認", "PDF化", "送付"],
    手配: [
      "仕様確認",
      "見積依頼",
      "価格交渉",
      "納期確認",
      "注文書発行",
      "注文請書受領",
    ],
    調整: [
      "候補日リストアップ",
      "客先連絡",
      "社内スケジュール確保",
      "会議室予約",
    ],
    調査: ["現場写真撮影", "寸法計測", "型式確認", "不具合箇所の特定"],
    設計: ["ラフスケッチ作成", "CAD作図", "検図", "出図"],
    選定: ["カタログ調査", "メーカー問い合わせ", "スペック比較", "型式決定"],
    確認: ["メールチェック", "電話連絡", "担当者へのヒアリング"],
    default: ["進捗報告", "資料整理", "メール連絡"],
  };

  // --- Helper Functions ---
  const calculateProgress = (projectId) => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    const completedTasks = projectTasks.filter((t) => t.completed).length;
    return Math.round((completedTasks / projectTasks.length) * 100);
  };

  const calculateSuggestedDeadline = (title, deliveryDateStr) => {
    if (!deliveryDateStr) return "";
    const deliveryDate = new Date(deliveryDateStr);
    if (isNaN(deliveryDate)) return "";

    let offsetDays = -3;
    if (title.match(/手配|注文|見積|発注/)) offsetDays = -30;
    else if (title.match(/設計|作図|計画/)) offsetDays = -20;
    else if (title.match(/準備|確認|リスト/)) offsetDays = -7;
    else if (title.match(/報告|請求/)) offsetDays = 3;

    deliveryDate.setDate(deliveryDate.getDate() + offsetDays);
    const yyyy = deliveryDate.getFullYear();
    const mm = String(deliveryDate.getMonth() + 1).padStart(2, "0");
    const dd = String(deliveryDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // 期限から状態(色分け用)を判定する関数
  const getDeadlineStatus = (deadlineStr, isCompleted) => {
    if (!deadlineStr || isCompleted) return "normal";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadlineStr);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "overdue"; // 過去（期限切れ）
    if (diffDays <= 3) return "urgent"; // 3日以内（期限間近）
    return "normal";
  };

  const getDeadlineColorClass = (status) => {
    if (status === "overdue")
      return "text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded";
    if (status === "urgent")
      return "text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded";
    return "text-gray-500";
  };

  const getSuggestions = (project) => {
    if (!project) return [];
    let suggestions = [];
    const pName = project.projectName;

    Object.keys(taskTemplates).forEach((key) => {
      if (key !== "default" && pName.includes(key)) {
        suggestions = [...suggestions, ...taskTemplates[key]];
      }
    });
    if (suggestions.length < 2) {
      suggestions = [
        ...suggestions,
        ...taskTemplates["工事"],
        ...taskTemplates["default"],
      ];
    } else {
      suggestions = [...suggestions, "完了報告書の作成", "請求書発行"];
    }

    const historyTasks = [];
    projects.forEach((p) => {
      if (p.id !== project.id) {
        const pTasks = tasks.filter((t) => t.projectId === p.id);
        pTasks.forEach((t) => {
          if (t.title) historyTasks.push(t.title);
        });
      }
    });

    const freqMap = {};
    historyTasks.forEach((t) => {
      freqMap[t] = (freqMap[t] || 0) + 1;
    });

    const sortedHistory = Object.keys(freqMap)
      .sort((a, b) => freqMap[b] - freqMap[a])
      .slice(0, 5);
    const mergedSuggestions = [...new Set([...suggestions, ...sortedHistory])];
    const existingTitles = tasks
      .filter((t) => t.projectId === project.id)
      .map((t) => t.title);

    return mergedSuggestions
      .filter((s) => !existingTitles.includes(s))
      .slice(0, 12)
      .map((title) => ({
        title: title,
        deadline: calculateSuggestedDeadline(title, project.deliveryDate),
      }));
  };

  const getSubTaskSuggestions = (taskTitle, currentTaskId) => {
    if (!taskTitle) return [];
    let suggestions = [];

    Object.keys(subTaskTemplates).forEach((key) => {
      if (key !== "default" && taskTitle.includes(key)) {
        suggestions = [...suggestions, ...subTaskTemplates[key]];
      }
    });
    if (suggestions.length === 0) {
      suggestions = [...subTaskTemplates["default"]];
    }

    const historySubTasks = [];
    tasks.forEach((t) => {
      if (
        t.id !== currentTaskId &&
        t.title &&
        (t.title.includes(taskTitle) || taskTitle.includes(t.title))
      ) {
        const relatedSt = subTasks.filter((st) => st.taskId === t.id);
        relatedSt.forEach((st) => {
          if (st.title) historySubTasks.push(st.title);
        });
      }
    });

    if (historySubTasks.length === 0) {
      subTasks.forEach((st) => {
        if (st.taskId !== currentTaskId && st.title)
          historySubTasks.push(st.title);
      });
    }

    const freqMap = {};
    historySubTasks.forEach((st) => {
      freqMap[st] = (freqMap[st] || 0) + 1;
    });

    const sortedHistory = Object.keys(freqMap)
      .sort((a, b) => freqMap[b] - freqMap[a])
      .slice(0, 5);
    const mergedSuggestions = [...new Set([...suggestions, ...sortedHistory])];
    const existingTitles = subTasks
      .filter((st) => st.taskId === currentTaskId)
      .map((st) => st.title);

    return mergedSuggestions
      .filter((s) => !existingTitles.includes(s))
      .slice(0, 8);
  };

  const copyToExcel = (project) => {
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    let tsv = `階層\t項目名\t期限\t状態\t備考\n`;
    tsv += `1\t[工事] ${project.machineNumber} ${project.projectName}\t${project.deliveryDate}\t${project.status}\t${project.customer}\n`;

    projectTasks.forEach((task) => {
      const taskStatus = task.completed ? "完了" : "未完了";
      const taskMemo = task.memo
        ? ` [メモ: ${task.memo.replace(/\n/g, " ")}]`
        : "";
      tsv += `2\t${task.title}\t${task.deadline || "-"}\t${taskStatus}\t${
        task.priority === "High" ? "優先度:高" : ""
      }${taskMemo}\n`;

      const relatedSubTasks = subTasks.filter((st) => st.taskId === task.id);
      relatedSubTasks.forEach((st) => {
        const stStatus = st.completed ? "完了" : "未完了";
        const stMemo = st.memo ? ` [メモ: ${st.memo.replace(/\n/g, " ")}]` : "";
        tsv += `3\t    - ${st.title}\t${
          st.deadline || "-"
        }\t${stStatus}\t${stMemo}\n`;
      });
    });

    navigator.clipboard.writeText(tsv).then(() => {
      alert(
        "Excel形式でクリップボードにコピーしました。\nExcelを開いて貼り付け(Ctrl+V)してください。"
      );
    });
  };

  const handlePrint = () => window.print();

  // --- Handlers (Firestore Actions) ---
  const updateProjectName = async (projectId, newName) => {
    if (!user || !newName.trim()) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "projects", projectId),
        { projectName: newName.trim() }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const updateTaskTitle = async (taskId, newTitle) => {
    if (!user || !newTitle.trim()) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "tasks", taskId),
        { title: newTitle.trim() }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const updateSubTaskTitle = async (subTaskId, newTitle) => {
    if (!user || !newTitle.trim()) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "subTasks", subTaskId),
        { title: newTitle.trim() }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const updateProjectDate = async (projectId, newDate) => {
    if (!user) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "projects", projectId),
        { deliveryDate: newDate }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const updateTaskDeadline = async (taskId, newDate) => {
    if (!user) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "tasks", taskId),
        { deadline: newDate }
      );
    } catch (e) {
      console.error(e);
    }
  };

  // サブタスクの期限更新を追加
  const updateSubTaskDeadline = async (subTaskId, newDate) => {
    if (!user) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "subTasks", subTaskId),
        { deadline: newDate }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const updateTaskMemo = async (taskId, newMemo) => {
    if (!user) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "tasks", taskId),
        { memo: newMemo }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const updateSubTaskMemo = async (subTaskId, newMemo) => {
    if (!user) return;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "subTasks", subTaskId),
        { memo: newMemo }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!newProject.projectName || !newProject.machineNumber || !user) return;

    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "projects"),
        {
          ...newProject,
          status: "Not Started",
          createdAt: Date.now(),
        }
      );
      setNewProject({
        machineNumber: "",
        projectName: "",
        customer: "",
        deliveryDate: "",
      });
      setActiveTab("management");
    } catch (e) {
      console.error("Error adding project: ", e);
      alert("プロジェクトの保存に失敗しました");
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !selectedProjectId || !user) return;
    addTask(newTask.title, newTask.deadline, newTask.priority);
    setNewTask({ title: "", deadline: "", priority: "Medium" });
  };

  const addTask = async (title, deadline = "", priority = "Medium") => {
    if (!selectedProjectId || !user) return;
    try {
      const docRef = await addDoc(
        collection(db, "artifacts", appId, "public", "data", "tasks"),
        {
          projectId: selectedProjectId,
          title: title,
          deadline: deadline,
          priority: priority,
          completed: false,
          memo: "",
          createdAt: Date.now(),
        }
      );
      setExpandedTaskIds((prev) => [...prev, docRef.id]);
    } catch (e) {
      console.error("Error adding task: ", e);
    }
  };

  const addSubTask = async (taskId, title) => {
    if (!title || !user) return;
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "subTasks"),
        {
          taskId: taskId,
          title: title,
          completed: false,
          deadline: "", // サブタスクにも期限を追加
          image: null,
          link: "",
          memo: "",
          createdAt: Date.now(),
        }
      );
    } catch (e) {
      console.error("Error adding subtask: ", e);
    }
  };

  const handleManualAddSubTask = (e, taskId) => {
    e.preventDefault();
    const title = newSubTaskTitles[taskId];
    addSubTask(taskId, title);
    setNewSubTaskTitles({ ...newSubTaskTitles, [taskId]: "" });
  };

  const handleImageUpload = (e, subTaskId) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 900 * 1024) {
        alert(
          "ファイルサイズが大きすぎます。1MB以下の画像を使用してください。"
        );
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        try {
          const subTaskRef = doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "subTasks",
            subTaskId
          );
          await updateDoc(subTaskRef, { image: base64String });
          setAttachmentMode((prev) => ({ ...prev, [subTaskId]: null }));
        } catch (error) {
          console.error("Error saving image:", error);
          alert("画像の保存に失敗しました。");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveLinkToFirestore = async (subTaskId, linkValue) => {
    if (!user) return;
    const subTaskRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "subTasks",
      subTaskId
    );
    await updateDoc(subTaskRef, { link: linkValue });
  };

  const toggleAttachmentMode = (subTaskId, mode) => {
    setAttachmentMode((prev) => ({
      ...prev,
      [subTaskId]: prev[subTaskId] === mode ? null : mode,
    }));
  };

  const toggleTaskCompletion = async (taskId) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "tasks", taskId),
        {
          completed: !task.completed,
        }
      );
    }
  };

  const toggleSubTaskCompletion = async (subTaskId) => {
    if (!user) return;
    const st = subTasks.find((s) => s.id === subTaskId);
    if (st) {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "subTasks", subTaskId),
        {
          completed: !st.completed,
        }
      );
    }
  };

  const toggleProjectStatus = async (projectId) => {
    if (!user) return;
    const p = projects.find((pr) => pr.id === projectId);
    if (p) {
      const newStatus = p.status === "Completed" ? "In Progress" : "Completed";
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "projects", projectId),
        { status: newStatus }
      );
    }
  };

  const deleteTask = async (taskId) => {
    if (!user) return;
    if (confirm("タスクとそれに紐づくサブタスクを削除しますか？")) {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "tasks", taskId)
      );
      const relatedSubTasks = subTasks.filter((st) => st.taskId === taskId);
      const batch = writeBatch(db);
      relatedSubTasks.forEach((st) => {
        const ref = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "subTasks",
          st.id
        );
        batch.delete(ref);
      });
      await batch.commit();
    }
  };

  const deleteSubTask = async (subTaskId) => {
    if (!user) return;
    await deleteDoc(
      doc(db, "artifacts", appId, "public", "data", "subTasks", subTaskId)
    );
  };

  const deleteProject = async (projectId) => {
    if (!user) return;
    if (confirm("この工事案件と関連する全タスク・サブタスクを削除しますか？")) {
      const projectRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "projects",
        projectId
      );
      const relatedTasks = tasks.filter((t) => t.projectId === projectId);
      const relatedSubTasks = subTasks.filter((st) =>
        relatedTasks.some((t) => t.id === st.taskId)
      );

      const batch = writeBatch(db);
      batch.delete(projectRef);
      relatedTasks.forEach((t) =>
        batch.delete(
          doc(db, "artifacts", appId, "public", "data", "tasks", t.id)
        )
      );
      relatedSubTasks.forEach((st) =>
        batch.delete(
          doc(db, "artifacts", appId, "public", "data", "subTasks", st.id)
        )
      );

      await batch.commit();
      if (selectedProjectId === projectId) setSelectedProjectId(null);
    }
  };

  const deleteImage = async (subTaskId) => {
    if (!user) return;
    const subTaskRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "subTasks",
      subTaskId
    );
    await updateDoc(subTaskRef, { image: null });
  };

  const toggleTaskExpand = (taskId) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleSubTaskSuggestions = (taskId) => {
    setShowSubTaskSuggestions((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const resetData = async () => {
    if (!user) return;
    if (
      confirm(
        "【警告】クラウド上の全てのデータを削除します。本当によろしいですか？"
      )
    ) {
      const batch = writeBatch(db);
      projects.forEach((p) =>
        batch.delete(
          doc(db, "artifacts", appId, "public", "data", "projects", p.id)
        )
      );
      tasks.forEach((t) =>
        batch.delete(
          doc(db, "artifacts", appId, "public", "data", "tasks", t.id)
        )
      );
      subTasks.forEach((s) =>
        batch.delete(
          doc(db, "artifacts", appId, "public", "data", "subTasks", s.id)
        )
      );

      await batch.commit();
      setSelectedProjectId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("リンクをコピーしました");
  };

  // --- Password Login Handler ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === APP_PASSWORD) {
      setIsAppLocked(false);
      setLoginError("");
    } else {
      setLoginError("パスワードが違います");
    }
  };

  // --- Components ---

  const StatusBadge = ({ progress, status }) => {
    if (status === "Completed") {
      return (
        <span className="px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">
          完了済み
        </span>
      );
    }
    let color = "bg-gray-100 text-gray-800";
    if (progress === 100) color = "bg-emerald-100 text-emerald-800";
    else if (progress > 0) color = "bg-teal-100 text-teal-800";
    return (
      <span
        className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${color}`}
      >
        {progress === 100 ? "100% 完了" : `${progress}% 完了`}
      </span>
    );
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const suggestions = showSuggestions ? getSuggestions(currentProject) : [];

  const displayedProjects = projects.filter((p) => {
    if (activeTab === "archive") return p.status === "Completed";
    if (activeTab === "share") return true;
    return p.status !== "Completed";
  });

  // ダッシュボード用のソートロジック
  let dashboardTasks = tasks.filter((task) => {
    const parent = projects.find((p) => p.id === task.projectId);
    return parent && parent.status !== "Completed";
  });

  dashboardTasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1; // 完了済みは常に下

    const projectA = projects.find((p) => p.id === a.projectId);
    const projectB = projects.find((p) => p.id === b.projectId);

    if (dashboardSortMode === "deadline") {
      const dateA = a.deadline ? new Date(a.deadline) : new Date("2099-12-31");
      const dateB = b.deadline ? new Date(b.deadline) : new Date("2099-12-31");
      return dateA - dateB;
    } else if (dashboardSortMode === "machineNumber") {
      const numA = projectA?.machineNumber || "";
      const numB = projectB?.machineNumber || "";
      return numA.localeCompare(numB);
    } else if (dashboardSortMode === "deliveryDate") {
      const dateA = projectA?.deliveryDate
        ? new Date(projectA.deliveryDate)
        : new Date("2099-12-31");
      const dateB = projectB?.deliveryDate
        ? new Date(projectB.deliveryDate)
        : new Date("2099-12-31");
      return dateA - dateB;
    }
    return 0;
  });

  // --- Render Password Screen ---
  if (isAppLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full border border-gray-100">
          <div className="text-center mb-6">
            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">A-Task</h1>
            <p className="text-sm text-gray-500 mt-1">工事管理・Todoアプリ</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="パスワードを入力"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
              {loginError && (
                <p className="text-red-500 text-xs mt-2 ml-1">{loginError}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Main App ---
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">接続エラー</h2>
          <p className="text-gray-600 mb-4">{authError}</p>
          <p className="text-xs text-gray-400">
            Firebaseの設定を確認し、ページを再読み込みしてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-800 print:bg-white print:block overflow-hidden relative">
      {/* --- Mobile Header (Hidden on Desktop) --- */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm print:hidden">
        <h1 className="text-xl font-bold text-emerald-700 flex items-center gap-2">
          <Layout size={24} />
          A-Task
        </h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-gray-600 hover:text-emerald-600 transition-colors p-1"
        >
          {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* --- Mobile Menu Overlay --- */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 print:hidden"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-screen">
            <button
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
              onClick={() => setPreviewImage(null)}
            >
              <X size={28} />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] rounded shadow-lg"
            />
          </div>
        </div>
      )}

      {/* --- Sidebar Navigation --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 print:hidden ${
          isMobileMenuOpen
            ? "translate-x-0 shadow-2xl w-64"
            : "-translate-x-full md:translate-x-0"
        } ${isSidebarCollapsed ? "md:w-20" : "md:w-64"}`}
      >
        <div
          className={`p-4 border-b border-gray-100 hidden md:flex items-center ${
            isSidebarCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isSidebarCollapsed && (
            <div>
              <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
                <Layout size={28} />
                A-Task
              </h1>
              <p className="text-[10px] text-gray-500 mt-1">工事管理・Todo</p>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-gray-400 hover:text-emerald-600 transition-colors p-1"
          >
            {isSidebarCollapsed ? (
              <Layout size={24} className="text-emerald-700" />
            ) : (
              <ChevronLeft size={24} />
            )}
          </button>
        </div>

        {/* Mobile menu title */}
        <div className="p-4 border-b border-gray-100 md:hidden flex items-center justify-between bg-gray-50">
          <span className="font-bold text-gray-700">メニュー</span>
          <button onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <nav className="p-2 md:p-4 space-y-2 flex-1 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setSelectedProjectId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-4"
            } py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "dashboard"
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            title="ダッシュボード"
          >
            <ListTodo size={18} />
            {!isSidebarCollapsed && <span>ダッシュボード</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab("timeline");
              setSelectedProjectId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-4"
            } py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "timeline"
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            title="タイムライン"
          >
            <CalendarDays size={18} />
            {!isSidebarCollapsed && <span>タイムライン</span>}
          </button>

          <div className="pt-4 pb-2">
            {!isSidebarCollapsed ? (
              <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                機能
              </p>
            ) : (
              <div className="border-t border-gray-200 w-8 mx-auto"></div>
            )}
          </div>

          <button
            onClick={() => {
              setActiveTab("input");
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-4"
            } py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "input"
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            title="新規登録"
          >
            <FileInput size={18} />
            {!isSidebarCollapsed && <span>新規登録</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab("management");
              setSelectedProjectId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-4"
            } py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "management"
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            title="管理・細分化"
          >
            <Settings size={18} />
            {!isSidebarCollapsed && <span>管理・細分化</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab("archive");
              setSelectedProjectId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-4"
            } py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "archive"
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            title="完了した工事"
          >
            <Archive size={18} />
            {!isSidebarCollapsed && <span>完了した工事</span>}
          </button>

          <div className="pt-4 pb-2">
            {!isSidebarCollapsed ? (
              <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                ツール
              </p>
            ) : (
              <div className="border-t border-gray-200 w-8 mx-auto"></div>
            )}
          </div>
          <button
            onClick={() => {
              setActiveTab("share");
              setSelectedProjectId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-4"
            } py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "share"
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            title="共有・レポート"
          >
            <Share2 size={18} />
            {!isSidebarCollapsed && <span>共有・レポート</span>}
          </button>
        </nav>

        <div
          className={`p-4 border-t border-gray-100 flex flex-col gap-2 ${
            isSidebarCollapsed ? "items-center" : ""
          }`}
        >
          <div
            className="flex items-center gap-2 text-xs text-gray-500"
            title="クラウド同期状態"
          >
            <Cloud
              size={16}
              className={loading ? "text-amber-500" : "text-emerald-500"}
            />
            {!isSidebarCollapsed && (
              <span>{loading ? "同期中..." : "クラウド保存: 有効"}</span>
            )}
          </div>
          {!isSidebarCollapsed ? (
            <button
              onClick={resetData}
              className="w-full text-xs text-gray-400 hover:text-red-500 flex items-center justify-center gap-1 py-2 mt-2"
            >
              <Trash2 size={12} /> 全データを削除
            </button>
          ) : (
            <button
              onClick={resetData}
              className="text-gray-400 hover:text-red-500 py-2 mt-2"
              title="全データを削除"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible h-[calc(100dvh-60px)] md:h-screen w-full relative">
        {/* --- DASHBOARD VIEW --- */}
        {activeTab === "dashboard" && (
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  業務ステータス
                </h2>
                <p className="text-sm text-gray-500">
                  本日のタスクと進行中の工事案件一覧
                </p>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Cloud size={12} /> クラウド同期中
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center sm:flex-col sm:items-start sm:justify-start">
                <p className="text-sm text-gray-500">未完了タスク</p>
                <p className="text-2xl md:text-3xl font-bold text-emerald-600">
                  {tasks.filter((t) => !t.completed).length}
                </p>
              </div>
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center sm:flex-col sm:items-start sm:justify-start">
                <p className="text-sm text-gray-500">進行中の工事</p>
                <p className="text-2xl md:text-3xl font-bold text-teal-600">
                  {projects.filter((p) => p.status !== "Completed").length}
                </p>
              </div>
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center sm:flex-col sm:items-start sm:justify-start">
                <p className="text-sm text-gray-500">本日の完了数</p>
                <p className="text-2xl md:text-3xl font-bold text-emerald-600">
                  {tasks.filter((t) => t.completed).length}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-800 text-sm md:text-base">
                  全タスクリスト
                </h3>
                <div className="flex items-center gap-2 text-xs md:text-sm">
                  <span className="text-gray-500">並び順:</span>
                  <select
                    value={dashboardSortMode}
                    onChange={(e) => setDashboardSortMode(e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-emerald-500 font-medium text-gray-700"
                  >
                    <option value="deadline">タスク期限順</option>
                    <option value="deliveryDate">納入日順</option>
                    <option value="machineNumber">機番順</option>
                  </select>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {dashboardTasks.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    タスクがありません。
                  </div>
                ) : (
                  dashboardTasks.map((task) => {
                    const parentProject = projects.find(
                      (p) => p.id === task.projectId
                    );
                    const dlStatus = getDeadlineStatus(
                      task.deadline,
                      task.completed
                    );
                    const dlColorClass = getDeadlineColorClass(dlStatus);

                    return (
                      <div
                        key={task.id}
                        className={`p-4 hover:bg-gray-50 flex items-start gap-3 md:gap-4 ${
                          task.completed ? "opacity-50" : ""
                        }`}
                      >
                        <button
                          onClick={() => toggleTaskCompletion(task.id)}
                          className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            task.completed
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-gray-300 text-transparent hover:border-emerald-500"
                          }`}
                        >
                          <CheckCircle size={14} fill="currentColor" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium text-sm md:text-base break-words ${
                              task.completed
                                ? "line-through text-gray-400"
                                : "text-gray-800"
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] md:text-xs text-gray-500">
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-medium truncate max-w-[120px]">
                              {parentProject?.machineNumber}
                            </span>
                            <span
                              className={`flex items-center gap-1 whitespace-nowrap ${dlColorClass}`}
                            >
                              <Calendar size={12} />{" "}
                              {task.deadline || "期限なし"}
                            </span>
                            {task.priority === "High" && (
                              <span className="text-red-600 font-bold whitespace-nowrap">
                                優先度: 高
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TIMELINE VIEW --- */}
        {activeTab === "timeline" && (
          <div className="max-w-6xl mx-auto h-full flex flex-col">
            <header className="mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                タイムライン (工程表)
              </h2>
              <p className="text-sm text-gray-500">
                全プロジェクトのスケジュール一覧
              </p>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto flex-1">
              <div className="p-4 md:p-6 min-w-[700px]">
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <div className="w-1/3 font-bold text-gray-600 text-sm">
                    プロジェクト / タスク
                  </div>
                  <div className="flex-1 flex justify-between text-xs text-gray-400 px-4">
                    <span>進行状況と期限</span>
                    <span className="text-emerald-600 font-bold">Today</span>
                    <span>Future</span>
                  </div>
                </div>

                <div className="space-y-6">
                  {projects
                    .filter((p) => p.status !== "Completed")
                    .map((project) => {
                      const projectTasks = tasks
                        .filter((t) => t.projectId === project.id)
                        .sort(
                          (a, b) => new Date(a.deadline) - new Date(b.deadline)
                        );
                      return (
                        <div
                          key={project.id}
                          className="border border-gray-100 rounded-lg p-3 md:p-4 bg-gray-50"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                              {project.machineNumber}
                            </span>
                            <h3 className="font-bold text-gray-800 text-sm">
                              {project.projectName}
                            </h3>
                            <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">
                              納入: {project.deliveryDate}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {projectTasks.map((task) => {
                              const dlStatus = getDeadlineStatus(
                                task.deadline,
                                task.completed
                              );
                              const dlColorClass =
                                getDeadlineColorClass(dlStatus);
                              return (
                                <div
                                  key={task.id}
                                  className="flex items-center gap-2 md:gap-4"
                                >
                                  <div className="w-1/3 text-xs md:text-sm truncate flex items-center gap-1.5 md:gap-2 pr-2">
                                    <span
                                      className={`flex-shrink-0 w-2 h-2 rounded-full ${
                                        task.completed
                                          ? "bg-emerald-400"
                                          : "bg-gray-300"
                                      }`}
                                    ></span>
                                    <span
                                      className={`truncate ${
                                        task.completed
                                          ? "text-gray-400 line-through"
                                          : "text-gray-700"
                                      }`}
                                    >
                                      {task.title}
                                    </span>
                                  </div>
                                  <div className="flex-1 bg-white h-7 md:h-8 rounded border border-gray-200 relative overflow-hidden flex items-center px-2">
                                    <div
                                      className={`text-[10px] md:text-xs flex items-center gap-1 z-10 relative ${dlColorClass}`}
                                    >
                                      <Calendar size={10} />{" "}
                                      {task.deadline || "期限なし"}
                                    </div>
                                    {task.completed && (
                                      <div className="absolute left-0 top-0 bottom-0 bg-emerald-100 w-full opacity-50"></div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- INPUT VIEW --- */}
        {activeTab === "input" && (
          <div className="max-w-2xl mx-auto h-full flex flex-col pt-4 md:pt-10">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                <FileInput className="text-emerald-600" /> 新規工事登録
              </h3>
              <p className="text-xs md:text-sm text-gray-500 mb-6">
                新しい案件の基本情報を入力してください。
              </p>
              <form
                onSubmit={handleAddProject}
                className="space-y-4 md:space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Hash size={14} /> 機番
                    </label>
                    <input
                      type="text"
                      placeholder="例: K-24001"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                      value={newProject.machineNumber}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          machineNumber: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar size={14} /> 納入日
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-gray-700"
                      value={newProject.deliveryDate}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          deliveryDate: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Briefcase size={14} /> 工事名
                  </label>
                  <input
                    type="text"
                    placeholder="例: A工場ライン増設工事"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                    value={newProject.projectName}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        projectName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Users size={14} /> 客先
                  </label>
                  <input
                    type="text"
                    placeholder="例: 株式会社A社"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                    value={newProject.customer}
                    onChange={(e) =>
                      setNewProject({ ...newProject, customer: e.target.value })
                    }
                  />
                </div>
                <div className="pt-2 md:pt-4">
                  <button
                    type="submit"
                    disabled={!user}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-sm md:text-base"
                  >
                    <Plus size={20} />
                    {user ? "登録して管理画面へ" : "接続中..."}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MANAGEMENT, ARCHIVE & SHARE VIEW (List/Detail implementation for mobile) --- */}
        {(activeTab === "management" ||
          activeTab === "archive" ||
          activeTab === "share") && (
          <div className="flex flex-col xl:flex-row gap-4 md:gap-6 h-full relative">
            {/* Left: Project List (Hidden on mobile if a project is selected) */}
            <div
              className={`xl:w-5/12 flex-col gap-3 md:gap-4 print:hidden ${
                selectedProjectId ? "hidden xl:flex" : "flex"
              }`}
            >
              <h3 className="text-base md:text-lg font-bold text-gray-700 flex items-center gap-2 px-1">
                {activeTab === "archive" ? (
                  <Archive size={18} />
                ) : activeTab === "share" ? (
                  <Share2 size={18} />
                ) : (
                  <Briefcase size={18} />
                )}
                {activeTab === "archive"
                  ? "完了した工事一覧"
                  : activeTab === "share"
                  ? "共有・レポート出力"
                  : "工事一覧（進行中）"}
              </h3>

              <div className="space-y-2 md:space-y-3 overflow-y-auto pb-10">
                {loading ? (
                  <div className="text-center p-8 text-gray-400 text-sm">
                    データを読み込み中...
                  </div>
                ) : displayedProjects.length === 0 ? (
                  <div className="bg-white p-6 rounded-lg text-center text-gray-400 border border-dashed border-gray-300 text-sm">
                    {activeTab === "archive"
                      ? "完了した工事はまだありません。"
                      : "対象の工事はありません。"}
                  </div>
                ) : (
                  displayedProjects.map((project) => {
                    const progress = calculateProgress(project.id);
                    const isSelected = selectedProjectId === project.id;
                    return (
                      <div
                        key={project.id}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setShowSuggestions(false);
                        }}
                        className={`cursor-pointer group bg-white rounded-lg border transition-all duration-200 ${
                          isSelected
                            ? "border-emerald-500 ring-1 ring-emerald-500 shadow-md"
                            : "border-gray-200 hover:border-emerald-300 shadow-sm"
                        } ${
                          project.status === "Completed"
                            ? "opacity-75 hover:opacity-100"
                            : ""
                        }`}
                      >
                        <div className="p-3 md:p-4">
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <div className="flex flex-col min-w-0">
                              <span
                                className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded w-fit mb-1 ${
                                  project.status === "Completed"
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-emerald-50 text-emerald-600"
                                }`}
                              >
                                {project.machineNumber}
                              </span>
                              <h4
                                className={`font-bold leading-tight text-sm md:text-base break-words ${
                                  project.status === "Completed"
                                    ? "text-gray-500 line-through"
                                    : "text-gray-800"
                                }`}
                              >
                                {project.projectName}
                              </h4>
                            </div>
                            <StatusBadge
                              progress={progress}
                              status={project.status}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs md:text-sm text-gray-500 mb-2 md:mb-3 mt-2">
                            <span className="flex items-center gap-1 md:gap-1.5 truncate">
                              <Users size={12} className="flex-shrink-0" />{" "}
                              <span className="truncate">
                                {project.customer}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 md:gap-1.5 justify-end whitespace-nowrap">
                              <Calendar size={12} className="flex-shrink-0" />{" "}
                              {project.deliveryDate}
                            </span>
                          </div>
                          {project.status !== "Completed" && (
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progress === 100
                                    ? "bg-emerald-500"
                                    : "bg-emerald-400"
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Project Detail / Share View (Hidden on mobile if NO project is selected) */}
            <div
              className={`xl:w-7/12 flex-col h-full md:h-[calc(100vh-64px)] md:sticky md:top-8 ${
                activeTab === "share"
                  ? "bg-white shadow-sm border border-gray-200 rounded-xl print:border-none print:shadow-none print:h-auto print:static"
                  : "bg-white rounded-xl shadow-sm border border-gray-200"
              } ${!selectedProjectId ? "hidden xl:flex" : "flex"}`}
            >
              {currentProject ? (
                <>
                  {/* --- Detail Header Area --- */}
                  <div
                    className={`p-4 md:p-6 border-b border-gray-100 rounded-t-xl ${
                      activeTab === "share"
                        ? "bg-white"
                        : currentProject.status === "Completed"
                        ? "bg-gray-100"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex flex-col mb-3 xl:hidden">
                      <button
                        onClick={() => setSelectedProjectId(null)}
                        className="flex items-center gap-1 text-emerald-600 text-sm font-bold w-fit hover:text-emerald-700 py-1"
                      >
                        <ArrowLeft size={16} /> 一覧へ戻る
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-0">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`text-white text-[10px] md:text-xs px-2 py-0.5 rounded font-mono ${
                              currentProject.status === "Completed"
                                ? "bg-gray-400"
                                : "bg-emerald-600"
                            }`}
                          >
                            {currentProject.machineNumber}
                          </span>
                          <span className="text-[10px] md:text-xs text-gray-500 flex items-center gap-1">
                            <Calendar size={12} /> 納入:
                            <InlineEdit
                              type="date"
                              value={currentProject.deliveryDate}
                              onSave={(val) =>
                                updateProjectDate(currentProject.id, val)
                              }
                              className="text-[10px] md:text-xs"
                              placeholderText="未設定"
                              allowEdit={
                                currentProject.status !== "Completed" &&
                                activeTab !== "share"
                              }
                            />
                          </span>
                          <span className="text-[10px] md:text-xs text-gray-500 flex items-center gap-1">
                            <Users size={12} />{" "}
                            <span className="truncate max-w-[150px]">
                              {currentProject.customer}
                            </span>
                          </span>
                        </div>
                        <h2
                          className={`text-lg md:text-xl font-bold break-words ${
                            currentProject.status === "Completed"
                              ? "text-gray-600"
                              : "text-gray-900"
                          }`}
                        >
                          <InlineEdit
                            value={currentProject.projectName}
                            onSave={(val) =>
                              updateProjectName(currentProject.id, val)
                            }
                            className="w-full"
                            allowEdit={
                              currentProject.status !== "Completed" &&
                              activeTab !== "share"
                            }
                          />
                        </h2>
                      </div>

                      {/* Control Buttons */}
                      <div className="flex flex-wrap items-center gap-2 print:hidden w-full md:w-auto mt-2 md:mt-0">
                        {activeTab === "share" ? (
                          <button
                            onClick={handlePrint}
                            className="flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2 md:py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
                          >
                            <Printer size={14} /> 印刷 / PDF保存
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => copyToExcel(currentProject)}
                              className="flex-1 md:flex-none justify-center flex items-center gap-1 px-2 py-2 md:py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg md:rounded hover:bg-green-100 text-xs font-medium transition-colors"
                              title="Excel形式でコピー"
                            >
                              <ClipboardCopy size={14} />
                              <span className="md:hidden">Excelコピー</span>
                              <span className="hidden md:inline">
                                Excel用にコピー
                              </span>
                            </button>

                            <button
                              onClick={() =>
                                toggleProjectStatus(currentProject.id)
                              }
                              className={`flex-1 md:flex-none justify-center flex items-center gap-1.5 md:gap-2 px-3 py-2 md:py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm ${
                                currentProject.status === "Completed"
                                  ? "bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              }`}
                            >
                              {currentProject.status === "Completed" ? (
                                <>
                                  <RefreshCw size={14} /> 再開
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={14} /> 完了
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => deleteProject(selectedProjectId)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                              title="工事案件を削除"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Task Input Form */}
                    {activeTab === "management" &&
                      currentProject.status !== "Completed" && (
                        <div className="mt-4 md:mt-5">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs md:text-sm font-bold text-gray-600 flex items-center gap-1">
                              <ListTodo size={14} /> タスク（Todo）を追加
                            </p>
                            <button
                              onClick={() =>
                                setShowSuggestions(!showSuggestions)
                              }
                              className={`text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 rounded-full flex items-center gap-1 md:gap-1.5 transition-all shadow-sm ${
                                showSuggestions
                                  ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300 font-bold"
                                  : "bg-white border border-gray-300 text-gray-600 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                              }`}
                            >
                              <Sparkles size={14} />
                              {showSuggestions
                                ? "提案を閉じる"
                                : "実績から提案"}
                            </button>
                          </div>
                          {showSuggestions && (
                            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 md:p-3">
                              <h4 className="text-[10px] md:text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                                <Lightbulb size={12} />「
                                {currentProject.projectName}」におすすめのタスク
                              </h4>
                              <div className="flex flex-wrap gap-1.5 md:gap-2">
                                {suggestions.length > 0 ? (
                                  suggestions.map((suggestion, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() =>
                                        addTask(
                                          suggestion.title,
                                          suggestion.deadline
                                        )
                                      }
                                      className="text-[10px] md:text-xs bg-white border border-amber-200 text-amber-900 px-2 py-1 md:py-1 rounded shadow-sm hover:bg-amber-100 flex items-center gap-1"
                                    >
                                      <Plus size={10} /> {suggestion.title}
                                      {suggestion.deadline && (
                                        <span className="text-[9px] text-amber-600 ml-0.5">
                                          ({suggestion.deadline})
                                        </span>
                                      )}
                                    </button>
                                  ))
                                ) : (
                                  <span className="text-xs text-amber-600">
                                    新しい提案はありません
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          <form
                            onSubmit={handleAddTask}
                            className="flex flex-col gap-2.5 bg-white p-2.5 md:p-3 rounded-lg border border-gray-200 shadow-sm"
                          >
                            <input
                              type="text"
                              placeholder="タスクを入力 (例: 図面作成)"
                              className="w-full px-2 md:px-3 py-1.5 md:py-2 border-b border-gray-200 focus:border-emerald-500 focus:outline-none text-sm"
                              value={newTask.title}
                              onChange={(e) =>
                                setNewTask({
                                  ...newTask,
                                  title: e.target.value,
                                })
                              }
                            />
                            <div className="flex flex-wrap sm:flex-nowrap gap-2">
                              <input
                                type="date"
                                className="flex-1 min-w-[120px] px-2 py-1.5 text-xs border border-gray-200 rounded text-gray-600 bg-white"
                                value={newTask.deadline}
                                onChange={(e) =>
                                  setNewTask({
                                    ...newTask,
                                    deadline: e.target.value,
                                  })
                                }
                              />
                              <select
                                className="flex-1 min-w-[100px] px-2 py-1.5 text-xs border border-gray-200 rounded text-gray-600 bg-white"
                                value={newTask.priority}
                                onChange={(e) =>
                                  setNewTask({
                                    ...newTask,
                                    priority: e.target.value,
                                  })
                                }
                              >
                                <option value="Low">優先度: 低</option>
                                <option value="Medium">優先度: 中</option>
                                <option value="High">優先度: 高</option>
                              </select>
                              <button
                                type="submit"
                                className="w-full sm:w-auto bg-emerald-600 text-white px-5 py-1.5 rounded text-xs font-bold hover:bg-emerald-700 transition-colors"
                              >
                                追加
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                  </div>

                  {/* --- Task List Area --- */}
                  <div
                    className={`flex-1 overflow-y-auto p-3 md:p-4 pb-32 md:pb-32 ${
                      activeTab === "share"
                        ? "bg-white"
                        : currentProject.status === "Completed"
                        ? "bg-gray-100"
                        : "bg-gray-50/50"
                    }`}
                  >
                    {currentProject.status === "Completed" &&
                      activeTab !== "share" && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs md:text-sm text-emerald-800 flex items-center gap-2">
                          <CheckCircle size={16} className="flex-shrink-0" />
                          この工事は完了しています。内容の確認のみ可能です。
                        </div>
                      )}

                    {tasks.filter((t) => t.projectId === selectedProjectId)
                      .length > 0 && (
                      <div className="flex justify-end mb-3">
                        <div className="flex items-center gap-2 text-xs md:text-sm">
                          <span className="text-gray-500">並び順:</span>
                          <select
                            value={taskSortMode}
                            onChange={(e) => setTaskSortMode(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-emerald-500 font-medium text-gray-700"
                          >
                            <option value="deadline">期限順</option>
                            <option value="createdAt">作成日順</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {tasks.filter((t) => t.projectId === selectedProjectId)
                      .length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[150px]">
                        <ListTodo size={48} className="mb-2 opacity-20" />
                        <p className="text-sm">タスクがまだありません</p>
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {tasks
                          .filter((t) => t.projectId === selectedProjectId)
                          .sort((a, b) => {
                            if (a.completed !== b.completed)
                              return a.completed ? 1 : -1; // 完了済みは一番下へ
                            if (taskSortMode === "deadline") {
                              const dateA = a.deadline
                                ? new Date(a.deadline).getTime()
                                : new Date("2099-12-31").getTime();
                              const dateB = b.deadline
                                ? new Date(b.deadline).getTime()
                                : new Date("2099-12-31").getTime();
                              if (dateA !== dateB) return dateA - dateB;
                              return (a.createdAt || 0) - (b.createdAt || 0); // 期限が同じ場合は作成日順
                            } else {
                              return (a.createdAt || 0) - (b.createdAt || 0);
                            }
                          })
                          .map((task) => {
                            const isExpanded =
                              expandedTaskIds.includes(task.id) ||
                              activeTab === "share";
                            const relatedSubTasks = subTasks.filter(
                              (st) => st.taskId === task.id
                            );
                            const taskSuggestions = showSubTaskSuggestions[
                              task.id
                            ]
                              ? getSubTaskSuggestions(task.title, task.id)
                              : [];

                            const tStatus = getDeadlineStatus(
                              task.deadline,
                              task.completed
                            );
                            const tColorClass = getDeadlineColorClass(tStatus);

                            // Share View
                            if (activeTab === "share") {
                              return (
                                <li
                                  key={task.id}
                                  className="border-b border-gray-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0 break-inside-avoid"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div
                                      className={`mt-0.5 w-3.5 h-3.5 md:w-4 md:h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                        task.completed
                                          ? "bg-black border-black text-white"
                                          : "border-gray-400"
                                      }`}
                                    >
                                      {task.completed && (
                                        <CheckCircle size={10} />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start gap-2">
                                        <span
                                          className={`font-bold text-sm md:text-base break-words ${
                                            task.completed
                                              ? "text-gray-500"
                                              : "text-black"
                                          }`}
                                        >
                                          {task.title}
                                        </span>
                                        <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap pt-0.5">
                                          期限: {task.deadline || "-"}
                                        </span>
                                      </div>
                                      {task.memo && (
                                        <div className="mt-1 flex items-start gap-1 text-xs text-gray-600">
                                          <FileText
                                            size={12}
                                            className="mt-0.5 flex-shrink-0 text-gray-400"
                                          />
                                          <span className="whitespace-pre-wrap">
                                            {task.memo}
                                          </span>
                                        </div>
                                      )}
                                      {relatedSubTasks.length > 0 && (
                                        <ul className="mt-2 ml-0.5 space-y-1.5 border-l-2 border-gray-200 pl-2.5 md:pl-3">
                                          {relatedSubTasks.map((st) => (
                                            <li
                                              key={st.id}
                                              className="text-xs md:text-sm flex flex-col items-start gap-0.5"
                                            >
                                              <div className="flex items-start gap-1.5 w-full justify-between">
                                                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                                  <span
                                                    className={`mt-1 flex-shrink-0 w-2.5 h-2.5 md:w-3 md:h-3 border flex items-center justify-center ${
                                                      st.completed
                                                        ? "bg-gray-600 border-gray-600"
                                                        : "border-gray-400"
                                                    }`}
                                                  >
                                                    {st.completed && (
                                                      <div className="w-1.5 h-1.5 bg-white"></div>
                                                    )}
                                                  </span>
                                                  <span
                                                    className={`break-words ${
                                                      st.completed
                                                        ? "text-gray-500"
                                                        : "text-gray-800"
                                                    }`}
                                                  >
                                                    {st.title}
                                                  </span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                  {st.deadline}
                                                </span>
                                              </div>
                                              {st.memo && (
                                                <div className="ml-4 mt-0.5 flex items-start gap-1 text-[10px] md:text-xs text-gray-500">
                                                  <FileText
                                                    size={10}
                                                    className="mt-0.5 flex-shrink-0 text-gray-400"
                                                  />
                                                  <span className="whitespace-pre-wrap">
                                                    {st.memo}
                                                  </span>
                                                </div>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              );
                            }

                            // Normal View
                            return (
                              <li
                                key={task.id}
                                className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${
                                  currentProject.status === "Completed"
                                    ? "opacity-80"
                                    : ""
                                }`}
                              >
                                {/* Task Header */}
                                <div className="flex items-start gap-2.5 md:gap-3 p-3 hover:bg-gray-50 transition-colors">
                                  <button
                                    onClick={() => toggleTaskExpand(task.id)}
                                    className="text-gray-400 hover:text-emerald-600 transition-colors mt-0.5"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown size={18} />
                                    ) : (
                                      <ChevronRight size={18} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      currentProject.status !== "Completed" &&
                                      toggleTaskCompletion(task.id)
                                    }
                                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                                      task.completed
                                        ? "bg-emerald-500 border-emerald-500"
                                        : "border-gray-300 hover:border-emerald-500"
                                    } ${
                                      currentProject.status === "Completed"
                                        ? "cursor-default"
                                        : ""
                                    }`}
                                  >
                                    {task.completed && (
                                      <CheckCircle
                                        size={14}
                                        className="text-white"
                                      />
                                    )}
                                  </button>
                                  <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => toggleTaskExpand(task.id)}
                                  >
                                    <span
                                      className={`block text-sm md:text-base font-medium break-words ${
                                        task.completed
                                          ? "text-gray-400 line-through"
                                          : "text-gray-800"
                                      }`}
                                    >
                                      <InlineEdit
                                        value={task.title}
                                        onSave={(val) =>
                                          updateTaskTitle(task.id, val)
                                        }
                                        className="w-full text-sm md:text-base"
                                        allowEdit={
                                          currentProject.status !==
                                            "Completed" && activeTab !== "share"
                                        }
                                      />
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      <span
                                        className={`text-[10px] md:text-xs flex items-center gap-1 ${tColorClass}`}
                                      >
                                        <Clock size={10} />
                                        <InlineEdit
                                          type="date"
                                          value={task.deadline || ""}
                                          onSave={(val) =>
                                            updateTaskDeadline(task.id, val)
                                          }
                                          className="text-[10px] md:text-xs font-normal text-black"
                                          placeholderText="期限なし"
                                          allowEdit={
                                            currentProject.status !==
                                              "Completed" &&
                                            activeTab !== "share"
                                          }
                                        />
                                      </span>
                                      {task.priority === "High" &&
                                        !task.completed && (
                                          <span className="text-[10px] md:text-xs text-red-500 font-bold border border-red-100 bg-red-50 px-1 rounded">
                                            最優先
                                          </span>
                                        )}
                                      {relatedSubTasks.length > 0 && (
                                        <span className="text-[10px] md:text-xs text-emerald-600 bg-emerald-50 px-1.5 rounded flex items-center gap-1">
                                          <ListTodo size={10} />
                                          {
                                            relatedSubTasks.filter(
                                              (st) => st.completed
                                            ).length
                                          }
                                          /{relatedSubTasks.length}
                                        </span>
                                      )}
                                    </div>
                                    {/* タスクメモ欄 */}
                                    <div
                                      className="mt-1.5 flex items-start gap-1.5 w-full"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <FileText
                                        size={12}
                                        className="text-gray-400 mt-0.5 flex-shrink-0"
                                      />
                                      <InlineEdit
                                        type="textarea"
                                        value={task.memo || ""}
                                        onSave={(val) =>
                                          updateTaskMemo(task.id, val)
                                        }
                                        className="text-[10px] md:text-xs"
                                        textClassName="text-[10px] md:text-xs text-gray-500"
                                        placeholderText="メモを追加..."
                                        allowEdit={
                                          currentProject.status !==
                                            "Completed" && activeTab !== "share"
                                        }
                                      />
                                    </div>
                                  </div>
                                  {currentProject.status !== "Completed" && (
                                    <button
                                      onClick={() => deleteTask(task.id)}
                                      className="text-gray-300 hover:text-red-500 transition-colors p-1.5 -mr-1.5"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>

                                {/* Subtasks Area */}
                                {isExpanded && (
                                  <div className="bg-gray-50 border-t border-gray-100 p-3 md:pl-10 pl-8">
                                    <ul className="space-y-3 mb-4">
                                      {relatedSubTasks.map((subTask) => {
                                        const stStatus = getDeadlineStatus(
                                          subTask.deadline,
                                          subTask.completed
                                        );
                                        const stColorClass =
                                          getDeadlineColorClass(stStatus);

                                        return (
                                          <li
                                            key={subTask.id}
                                            className="flex flex-col gap-1.5 text-sm group border-b border-gray-200 pb-3 last:border-0 last:pb-0"
                                          >
                                            <div className="flex items-start gap-2">
                                              <button
                                                onClick={() =>
                                                  currentProject.status !==
                                                    "Completed" &&
                                                  toggleSubTaskCompletion(
                                                    subTask.id
                                                  )
                                                }
                                                className={`mt-0.5 text-gray-400 flex-shrink-0 ${
                                                  currentProject.status ===
                                                  "Completed"
                                                    ? ""
                                                    : "hover:text-emerald-600"
                                                }`}
                                              >
                                                {subTask.completed ? (
                                                  <CheckSquare
                                                    size={16}
                                                    className="text-emerald-500"
                                                  />
                                                ) : (
                                                  <Square size={16} />
                                                )}
                                              </button>

                                              <div className="flex-1 flex flex-col gap-1 min-w-0">
                                                <span
                                                  className={`text-xs md:text-sm break-words ${
                                                    subTask.completed
                                                      ? "text-gray-400 line-through"
                                                      : "text-gray-700"
                                                  }`}
                                                >
                                                  <InlineEdit
                                                    value={subTask.title}
                                                    onSave={(val) =>
                                                      updateSubTaskTitle(
                                                        subTask.id,
                                                        val
                                                      )
                                                    }
                                                    className="w-full text-xs md:text-sm"
                                                    allowEdit={
                                                      currentProject.status !==
                                                        "Completed" &&
                                                      activeTab !== "share"
                                                    }
                                                  />
                                                </span>

                                                {/* サブタスクの期限 */}
                                                <span
                                                  className={`text-[10px] md:text-xs flex items-center gap-1 w-fit ${stColorClass}`}
                                                >
                                                  <Clock size={10} />
                                                  <InlineEdit
                                                    type="date"
                                                    value={
                                                      subTask.deadline || ""
                                                    }
                                                    onSave={(val) =>
                                                      updateSubTaskDeadline(
                                                        subTask.id,
                                                        val
                                                      )
                                                    }
                                                    className="text-[10px] md:text-xs font-normal text-black"
                                                    placeholderText="期限なし"
                                                    allowEdit={
                                                      currentProject.status !==
                                                        "Completed" &&
                                                      activeTab !== "share"
                                                    }
                                                  />
                                                </span>
                                              </div>

                                              {/* Action Buttons */}
                                              {currentProject.status !==
                                                "Completed" && (
                                                <div className="flex items-center gap-0.5 opacity-100 md:opacity-50 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                  <button
                                                    onClick={() =>
                                                      toggleAttachmentMode(
                                                        subTask.id,
                                                        "image"
                                                      )
                                                    }
                                                    className={`p-1.5 rounded hover:bg-gray-200 ${
                                                      subTask.image
                                                        ? "text-emerald-600"
                                                        : "text-gray-400"
                                                    }`}
                                                    title="画像を追加/確認"
                                                  >
                                                    <ImageIcon size={14} />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      toggleAttachmentMode(
                                                        subTask.id,
                                                        "link"
                                                      )
                                                    }
                                                    className={`p-1.5 rounded hover:bg-gray-200 ${
                                                      subTask.link
                                                        ? "text-blue-600"
                                                        : "text-gray-400"
                                                    }`}
                                                    title="リンクを追加/確認"
                                                  >
                                                    <LinkIcon size={14} />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      deleteSubTask(subTask.id)
                                                    }
                                                    className="text-gray-300 hover:text-red-500 transition-colors p-1.5"
                                                    title="削除"
                                                  >
                                                    <Trash2 size={14} />
                                                  </button>
                                                </div>
                                              )}
                                            </div>

                                            {/* Preview / Attachment / Memo Section */}
                                            <div className="ml-6 flex flex-col gap-2 pr-1">
                                              {/* 新規: サブタスク メモ欄 */}
                                              <div className="flex items-start gap-1.5 w-full mt-0.5">
                                                <FileText
                                                  size={12}
                                                  className="text-gray-400 mt-0.5 flex-shrink-0"
                                                />
                                                <InlineEdit
                                                  type="textarea"
                                                  value={subTask.memo || ""}
                                                  onSave={(val) =>
                                                    updateSubTaskMemo(
                                                      subTask.id,
                                                      val
                                                    )
                                                  }
                                                  className="text-[10px] md:text-xs"
                                                  textClassName="text-[10px] md:text-xs text-gray-500"
                                                  placeholderText="メモを追加..."
                                                  allowEdit={
                                                    currentProject.status !==
                                                      "Completed" &&
                                                    activeTab !== "share"
                                                  }
                                                />
                                              </div>

                                              {/* Image Preview & Input */}
                                              {(subTask.image ||
                                                attachmentMode[subTask.id] ===
                                                  "image") && (
                                                <div className="flex items-start gap-2 bg-gray-100 rounded p-2 mt-1">
                                                  {subTask.image ? (
                                                    <div className="relative group/img">
                                                      <img
                                                        src={subTask.image}
                                                        alt="attachment"
                                                        className="h-14 md:h-16 w-auto rounded border border-gray-300 cursor-zoom-in"
                                                        onClick={() =>
                                                          setPreviewImage(
                                                            subTask.image
                                                          )
                                                        }
                                                      />
                                                      {currentProject.status !==
                                                        "Completed" &&
                                                        attachmentMode[
                                                          subTask.id
                                                        ] === "image" && (
                                                          <button
                                                            onClick={() =>
                                                              deleteImage(
                                                                subTask.id
                                                              )
                                                            }
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-100 md:opacity-0 md:group-hover/img:opacity-100 transition-opacity"
                                                            title="画像を削除"
                                                          >
                                                            <X size={10} />
                                                          </button>
                                                        )}
                                                    </div>
                                                  ) : (
                                                    <div className="flex-1">
                                                      <label className="flex flex-col items-center justify-center w-full h-14 md:h-16 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                                        <div className="flex flex-col items-center justify-center pt-2 pb-2">
                                                          <ImageIcon
                                                            size={14}
                                                            className="text-gray-400 mb-0.5"
                                                          />
                                                          <p className="text-[9px] md:text-[10px] text-gray-500">
                                                            画像を選択(1MB以下)
                                                          </p>
                                                        </div>
                                                        <input
                                                          type="file"
                                                          className="hidden"
                                                          accept="image/*"
                                                          onChange={(e) =>
                                                            handleImageUpload(
                                                              e,
                                                              subTask.id
                                                            )
                                                          }
                                                        />
                                                      </label>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              {/* Link Preview & Input */}
                                              {(subTask.link ||
                                                attachmentMode[subTask.id] ===
                                                  "link") && (
                                                <div className="flex items-center gap-2 bg-blue-50 rounded p-2 border border-blue-100 mt-1">
                                                  {attachmentMode[
                                                    subTask.id
                                                  ] === "link" &&
                                                  currentProject.status !==
                                                    "Completed" ? (
                                                    <div className="flex items-center gap-1.5 w-full">
                                                      <LinkIcon
                                                        size={12}
                                                        className="text-blue-400 flex-shrink-0"
                                                      />
                                                      <input
                                                        type="text"
                                                        className="flex-1 text-[10px] md:text-xs bg-white border border-blue-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-400 min-w-0"
                                                        placeholder="URLまたはパスを入力..."
                                                        defaultValue={
                                                          subTask.link
                                                        }
                                                        onBlur={(e) =>
                                                          saveLinkToFirestore(
                                                            subTask.id,
                                                            e.target.value
                                                          )
                                                        }
                                                      />
                                                      <button
                                                        onClick={() =>
                                                          toggleAttachmentMode(
                                                            subTask.id,
                                                            null
                                                          )
                                                        }
                                                        className="text-blue-500 hover:text-blue-700 bg-white rounded p-0.5 border border-blue-200 flex-shrink-0"
                                                      >
                                                        <CheckCircle
                                                          size={14}
                                                        />
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center justify-between w-full min-w-0">
                                                      <div className="flex items-center gap-1.5 overflow-hidden pr-2">
                                                        <LinkIcon
                                                          size={12}
                                                          className="text-blue-500 flex-shrink-0"
                                                        />
                                                        <a
                                                          href={
                                                            subTask.link.startsWith(
                                                              "http"
                                                            )
                                                              ? subTask.link
                                                              : "#"
                                                          }
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-[10px] md:text-xs text-blue-600 truncate underline hover:text-blue-800 block"
                                                          onClick={(e) =>
                                                            !subTask.link.startsWith(
                                                              "http"
                                                            ) &&
                                                            e.preventDefault()
                                                          }
                                                        >
                                                          {subTask.link}
                                                        </a>
                                                      </div>
                                                      <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button
                                                          onClick={() =>
                                                            copyToClipboard(
                                                              subTask.link
                                                            )
                                                          }
                                                          className="text-gray-400 hover:text-gray-600 p-1.5 bg-white rounded border border-gray-200"
                                                          title="パスをコピー"
                                                        >
                                                          <Copy size={10} />
                                                        </button>
                                                        {subTask.link.startsWith(
                                                          "http"
                                                        ) && (
                                                          <a
                                                            href={subTask.link}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-gray-400 hover:text-gray-600 p-1.5 bg-white rounded border border-gray-200 block"
                                                          >
                                                            <ExternalLink
                                                              size={10}
                                                            />
                                                          </a>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>

                                    {currentProject.status !== "Completed" && (
                                      <>
                                        {/* Subtask Suggestions Panel */}
                                        {showSubTaskSuggestions[task.id] && (
                                          <div className="mb-3 bg-amber-50/50 border border-amber-200/50 rounded-lg p-2.5">
                                            <div className="flex items-center gap-1 text-[10px] md:text-xs text-amber-700 mb-1.5 font-bold">
                                              <Lightbulb size={10} />{" "}
                                              おすすめのサブタスク
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {taskSuggestions.map(
                                                (suggestion, idx) => (
                                                  <button
                                                    key={idx}
                                                    onClick={() =>
                                                      addSubTask(
                                                        task.id,
                                                        suggestion
                                                      )
                                                    }
                                                    className="text-[10px] bg-white border border-amber-200 text-amber-900 px-2 py-1 rounded shadow-sm hover:bg-amber-100 flex items-center gap-1 transition-colors"
                                                  >
                                                    <Plus size={8} />{" "}
                                                    {suggestion}
                                                  </button>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Add Subtask Form */}
                                        <div className="flex flex-col gap-2 mt-1">
                                          <div className="flex items-center justify-between">
                                            <button
                                              onClick={() =>
                                                toggleSubTaskSuggestions(
                                                  task.id
                                                )
                                              }
                                              className={`text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                                                showSubTaskSuggestions[task.id]
                                                  ? "bg-amber-100 text-amber-700"
                                                  : "bg-gray-100 text-gray-500 hover:text-amber-600 hover:bg-amber-50"
                                              }`}
                                            >
                                              <Sparkles size={10} />
                                              {showSubTaskSuggestions[task.id]
                                                ? "提案を閉じる"
                                                : "実績から提案"}
                                            </button>
                                          </div>

                                          <form
                                            onSubmit={(e) =>
                                              handleManualAddSubTask(e, task.id)
                                            }
                                            className="flex items-center gap-1.5 md:gap-2"
                                          >
                                            <CornerDownRight
                                              size={14}
                                              className="text-gray-400 flex-shrink-0"
                                            />
                                            <input
                                              type="text"
                                              placeholder="サブタスクを追加..."
                                              className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 min-w-0"
                                              value={
                                                newSubTaskTitles[task.id] || ""
                                              }
                                              onChange={(e) =>
                                                setNewSubTaskTitles({
                                                  ...newSubTaskTitles,
                                                  [task.id]: e.target.value,
                                                })
                                              }
                                            />
                                            <button
                                              type="submit"
                                              className="flex-shrink-0 text-[10px] md:text-xs bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 px-3 py-1.5 rounded font-medium"
                                            >
                                              追加
                                            </button>
                                          </form>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50 rounded-xl border border-gray-100">
                  <Settings size={48} className="mb-4 opacity-20" />
                  <p className="font-medium text-gray-600 text-sm md:text-base">
                    左の一覧から工事案件を選択してください
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
