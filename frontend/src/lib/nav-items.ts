import ApiIcon from "@mui/icons-material/Api";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChatIcon from "@mui/icons-material/Chat";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DescriptionIcon from "@mui/icons-material/Description";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import SearchIcon from "@mui/icons-material/Search";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import StorageIcon from "@mui/icons-material/Storage";
import type { SvgIconComponent } from "@mui/icons-material";

export type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: SvgIconComponent;
};

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    description: "Overview of the learning lab and feature status.",
    icon: DashboardIcon,
  },
  {
    label: "AI Chat Assistant",
    href: "/chat",
    description: "Conversational assistant with streaming responses.",
    icon: ChatIcon,
  },
  {
    label: "Document Processing",
    href: "/documents",
    description: "Upload, parse, and chunk documents for AI use.",
    icon: DescriptionIcon,
  },
  {
    label: "Knowledge Center",
    href: "/knowledge",
    description: "Structured storage for processed documents.",
    icon: LibraryBooksIcon,
  },
  {
    label: "RAG",
    href: "/rag",
    description: "Retrieval-augmented generation with citations.",
    icon: AutoAwesomeIcon,
  },
  {
    label: "Enterprise Search",
    href: "/search",
    description: "Hybrid keyword and semantic search with ranking.",
    icon: SearchIcon,
  },
  {
    label: "SQL Assistant",
    href: "/sql-assistant",
    description: "Natural language to validated SQL queries.",
    icon: StorageIcon,
  },
  {
    label: "API Intelligence",
    href: "/api-intelligence",
    description: "Schema-aware API understanding and tool calling.",
    icon: ApiIcon,
  },
  {
    label: "AI Agents",
    href: "/agents",
    description: "Multi-step planning, tool use, and reflection.",
    icon: SmartToyIcon,
  },
  {
    label: "Workflow Automation",
    href: "/workflows",
    description: "Multi-step processes with human approval steps.",
    icon: AccountTreeIcon,
  },
  {
    label: "Execution Monitoring",
    href: "/monitoring",
    description: "Tracing, token usage, and cost tracking.",
    icon: MonitorHeartIcon,
  },
  {
    label: "Model Evaluation",
    href: "/evaluation",
    description: "Systematic testing of prompts and model outputs.",
    icon: AssessmentIcon,
  },
  {
    label: "Administration",
    href: "/admin",
    description: "Users, model providers, and governance controls.",
    icon: AdminPanelSettingsIcon,
  },
];
