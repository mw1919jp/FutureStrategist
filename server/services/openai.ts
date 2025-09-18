import OpenAI from "openai";
import { logApiRequest, logApiResponse } from "../utils/logger";
import type { YearResult } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

// Ultra-fast OpenAI client specifically for expert prediction with no retries and 1.8s timeout
const fastOpenai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
  maxRetries: 0,
  timeout: 10000, // 10 second timeout for detailed expert prediction
});

// In-memory cache for expert predictions with TTL
interface CacheEntry {
  data: ExpertPrediction;
  timestamp: number;
  ttl: number;
}

// Circuit breaker state management
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const predictionCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<ExpertPrediction>>();
const circuitBreaker = new Map<string, CircuitBreakerState>();

// Cache TTL: 15 minutes
const CACHE_TTL = 15 * 60 * 1000;
// Circuit breaker timeout: 10 seconds
const CIRCUIT_BREAKER_TIMEOUT = 10 * 1000;
// Hard deadline for total response: 10 seconds (for detailed AI prediction)
const HARD_DEADLINE = 10000;

export interface ExpertAnalysis {
  expert: string;
  content: string;
  recommendations: string[];
}

export interface PhaseResult {
  phase: number;
  title: string;
  content: string;
  analyses?: ExpertAnalysis[];
  recommendations?: string[];
}

export interface ScenarioAnalysisResult {
  phases: PhaseResult[];
  finalRecommendations: string[];
  markdownReport: string;
}

export interface ExpertPrediction {
  role: string;
  specialization: string;
  expertiseLevel: string;
  subSpecializations: string[];
  informationSources: string[];
  researchFocus: string;
}

// Template-based fallback responses for future prediction analysis
const expertFallbackTemplates: Record<string, ExpertPrediction> = {
  // AI・テクノロジー分野
  "AI研究者": {
    role: "次世代AI技術と社会実装の専門家",
    specialization: "AGI・量子AI・神経インターフェース技術",
    expertiseLevel: "expert",
    subSpecializations: ["汎用人工知能(AGI)", "量子機械学習", "脳-コンピューターインターフェース"],
    informationSources: ["Nature AI論文", "MIT Technology Review", "OpenAI研究報告"],
    researchFocus: "2030年代のAGI社会実装と労働市場への影響予測"
  },
  "AIエンジニア": {
    role: "AI実装・運用基盤設計の専門家",
    specialization: "エンタープライズAI・MLOps・AI倫理",
    expertiseLevel: "expert",
    subSpecializations: ["大規模言語モデル運用", "AI倫理・安全性", "エッジAI最適化"],
    informationSources: ["Kubernetes AI Report", "NVIDIA技術動向", "AI Ethics Guidelines"],
    researchFocus: "2040年までの企業AI基盤と競争優位性の構築"
  },
  "データサイエンティスト": {
    role: "予測分析・意思決定支援システムの専門家",
    specialization: "リアルタイム分析・因果推論・予測モデリング",
    expertiseLevel: "expert",
    subSpecializations: ["因果機械学習", "リアルタイムストリーミング分析", "シミュレーション予測"],
    informationSources: ["KDD会議論文", "McKinsey Analytics Report", "Gartner予測"],
    researchFocus: "2050年の意思決定自動化と人間-AI協働モデル"
  },

  // ビジネス・経営分野
  "経営コンサルタント": {
    role: "デジタル変革・未来戦略設計の専門家",
    specialization: "持続可能経営・レジリエント組織・新興市場戦略",
    expertiseLevel: "senior",
    subSpecializations: ["サーキュラーエコノミー移行", "地政学リスク対応", "ステークホルダー資本主義"],
    informationSources: ["BCG Future of Work", "WEF Global Risks Report", "PwC CEO Survey"],
    researchFocus: "2030年代の地政学変化と企業の長期競争戦略"
  },
  "経済学者": {
    role: "マクロ経済・国際金融システム変化の専門家",
    specialization: "デジタル通貨・新興国経済・気候経済学",
    expertiseLevel: "expert",
    subSpecializations: ["中央銀行デジタル通貨(CBDC)", "脱炭素経済移行", "新興市場金融統合"],
    informationSources: ["IMF World Economic Outlook", "BIS年次報告", "Climate Policy Initiative"],
    researchFocus: "2040年の国際金融システム再編と企業財務戦略"
  },
  "投資アナリスト": {
    role: "新興資産・ESG投資・テクノロジー評価の専門家",
    specialization: "量子技術投資・宇宙経済・バイオテック評価",
    expertiseLevel: "expert",
    subSpecializations: ["量子コンピューティング市場", "宇宙商業化投資", "合成生物学評価"],
    informationSources: ["Goldman Sachs Future Tech", "ARK Invest Research", "Nature Biotechnology"],
    researchFocus: "2050年の破壊的技術への投資機会と企業価値創造"
  },

  // デザイン・UX分野
  "デザイナー": {
    role: "次世代インターフェース・体験設計の専門家",
    specialization: "空間UI・神経インターフェース・感情AI連携デザイン",
    expertiseLevel: "expert",
    subSpecializations: ["AR/VR空間インターフェース", "脳波UI/UX設計", "感情認識体験デザイン"],
    informationSources: ["Apple Human Interface Guidelines", "Meta Reality Labs Research", "MIT Media Lab"],
    researchFocus: "2030年代の没入型体験と人間中心設計の進化"
  },
  "UXデザイナー": {
    role: "行動科学・認知負荷・アクセシビリティの専門家",
    specialization: "ユニバーサルデザイン・AI支援UX・高齢化対応",
    expertiseLevel: "expert",
    subSpecializations: ["認知アクセシビリティ設計", "AI協働インターフェース", "多世代対応体験設計"],
    informationSources: ["W3C Accessibility Guidelines", "Nielsen Norman Group", "Adobe UX Trends"],
    researchFocus: "2040年の超高齢社会とインクルーシブテクノロジー"
  },

  // 技術・エンジニアリング分野
  "技術者": {
    role: "インフラ・セキュリティ・分散システムの専門家",
    specialization: "量子暗号・エッジコンピューティング・自律システム",
    expertiseLevel: "expert",
    subSpecializations: ["量子暗号通信", "分散エッジAI", "自己修復システム"],
    informationSources: ["IEEE Computer Society", "NIST Cybersecurity Framework", "Linux Foundation Reports"],
    researchFocus: "2030年代の量子脅威対応と次世代インフラ設計"
  },
  "ITコンサルタント": {
    role: "エンタープライズ変革・クラウド戦略の専門家",
    specialization: "レガシー刷新・ハイブリッドクラウド・DevSecOps",
    expertiseLevel: "senior",
    subSpecializations: ["メインフレーム現代化", "マルチクラウド戦略", "ゼロトラスト実装"],
    informationSources: ["Gartner IT Roadmap", "Forrester Cloud Strategy", "Red Hat Enterprise Trends"],
    researchFocus: "2040年のエンタープライズIT基盤と競争優位性"
  },

  // マーケティング・営業分野
  "マーケティング専門家": {
    role: "パーソナライゼーション・オムニチャネル戦略の専門家",
    specialization: "AI駆動マーケティング・メタバース商業・Z世代エンゲージメント",
    expertiseLevel: "expert",
    subSpecializations: ["リアルタイムパーソナライゼーション", "仮想空間コマース", "行動予測マーケティング"],
    informationSources: ["HubSpot Future of Marketing", "Salesforce Customer 360", "Adobe Digital Economy Index"],
    researchFocus: "2030年代の消費者行動変化とブランド体験設計"
  },

  // 環境・サステナビリティ分野
  "環境専門家": {
    role: "気候変動・資源循環・生態系保全の専門家",
    specialization: "カーボンニュートラル・サーキュラーエコノミー・生物多様性",
    expertiseLevel: "expert",
    subSpecializations: ["炭素除去技術(DAC)", "バイオベース材料", "生態系サービス評価"],
    informationSources: ["IPCC Assessment Reports", "Ellen MacArthur Foundation", "Nature Climate Change"],
    researchFocus: "2050年ネットゼロ達成のための企業戦略とイノベーション"
  },

  // ヘルスケア・バイオテクノロジー分野
  "医療専門家": {
    role: "デジタル医療・予防医学・精密医療の専門家",
    specialization: "遠隔医療・AI診断・個別化治療",
    expertiseLevel: "expert",
    subSpecializations: ["ウェアラブル診断", "ゲノム解析医療", "AI創薬支援"],
    informationSources: ["New England Journal of Medicine", "Nature Medicine", "WHO Digital Health Reports"],
    researchFocus: "2040年の予防中心医療と健康寿命延伸技術"
  },

  // 教育・人材開発分野
  "教育専門家": {
    role: "未来スキル・生涯学習・AI協働教育の専門家",
    specialization: "パーソナライズ学習・VR教育・スキル予測",
    expertiseLevel: "expert",
    subSpecializations: ["適応的学習システム", "仮想実習環境", "未来スキル予測"],
    informationSources: ["MIT OpenCourseWare Research", "Khan Academy Insights", "OECD Education Reports"],
    researchFocus: "2030年代の労働市場変化と継続的スキル開発"
  },

  // 法務・規制分野
  "法務専門家": {
    role: "テクノロジー法・データガバナンス・国際規制の専門家",
    specialization: "AI規制・プライバシー・国際データ移転",
    expertiseLevel: "expert",
    subSpecializations: ["AI責任法制", "量子暗号規制", "国際データガバナンス"],
    informationSources: ["European AI Act", "GDPR Implementation Reports", "Stanford HAI Policy"],
    researchFocus: "2040年の国際規制調和と企業コンプライアンス戦略"
  }
};

export class OpenAIService {
  // Cache management methods
  private getCachedPrediction(expertName: string): ExpertPrediction | null {
    const entry = predictionCache.get(expertName);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      predictionCache.delete(expertName);
      return null;
    }
    
    console.log(`[ExpertPrediction] Cache hit for ${expertName}`);
    return entry.data;
  }

  private cachePrediction(expertName: string, prediction: ExpertPrediction): void {
    predictionCache.set(expertName, {
      data: prediction,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });
  }

  // Circuit breaker management
  private shouldBreakCircuit(expertName: string): boolean {
    const state = circuitBreaker.get(expertName);
    if (!state) return false;
    
    const now = Date.now();
    if (state.isOpen && (now - state.lastFailureTime) > CIRCUIT_BREAKER_TIMEOUT) {
      // Reset circuit breaker after timeout
      circuitBreaker.delete(expertName);
      console.log(`[ExpertPrediction] Circuit breaker reset for ${expertName}`);
      return false;
    }
    
    if (state.isOpen) {
      console.log(`[ExpertPrediction] Circuit breaker open for ${expertName}, using fallback`);
      return true;
    }
    
    return false;
  }

  private recordCircuitBreakerFailure(expertName: string, error: any): void {
    const now = Date.now();
    const state = circuitBreaker.get(expertName) || { failureCount: 0, lastFailureTime: 0, isOpen: false };
    
    // Check for known failure conditions
    const isKnownFailure = 
      error.code === 'insufficient_quota' ||
      error.status === 429 ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('Request timed out') ||
      error.message?.includes('timeout');
    
    if (isKnownFailure) {
      state.failureCount += 1;
      state.lastFailureTime = now;
      state.isOpen = state.failureCount >= 2; // Open circuit after 2 failures
      
      circuitBreaker.set(expertName, state);
      console.log(`[ExpertPrediction] Circuit breaker failure recorded for ${expertName}. Count: ${state.failureCount}, Open: ${state.isOpen}`);
    }
  }

  private generateGenericRole(expertName: string): {
    description: string;
    specialization: string;
    subSpecializations: string[];
    informationSources: string[];
    researchFocus: string;
  } {
    // Analyze expert name for domain hints
    const nameLower = expertName.toLowerCase();
    
    // Energy & Electric Vehicle
    if (nameLower.includes('ev') || nameLower.includes('電気自動車') || nameLower.includes('バッテリー') || nameLower.includes('充電')) {
      return {
        description: "電気自動車・次世代モビリティの専門家",
        specialization: "EV普及戦略・充電インフラ・バッテリー技術・自動運転",
        subSpecializations: ["EVバッテリー技術", "充電インフラ整備", "自動運転システム"],
        informationSources: ["EV市場分析レポート", "バッテリー技術動向", "モビリティ業界調査"],
        researchFocus: "2030-2040年のEV完全普及と交通システム変革"
      };
    }
    
    // Gas & Energy Infrastructure
    if (nameLower.includes('ガス') || nameLower.includes('gas') || nameLower.includes('エネルギー') || nameLower.includes('電力') || nameLower.includes('電気')) {
      return {
        description: "エネルギー・電力システム・脱炭素化の専門家",
        specialization: "再生可能エネルギー・スマートグリッド・カーボンニュートラル",
        subSpecializations: ["再生エネルギー統合", "エネルギー貯蔵システム", "脱炭素化戦略"],
        informationSources: ["IEA世界エネルギー展望", "再生エネルギー統計", "脱炭素技術レポート"],
        researchFocus: "2050年カーボンニュートラル実現とエネルギー産業構造変革"
      };
    }
    
    // Sports & Media
    if (nameLower.includes('スポーツ') || nameLower.includes('sports') || nameLower.includes('ライター') || nameLower.includes('記者') || nameLower.includes('メディア')) {
      return {
        description: "スポーツビジネス・メディア・エンターテインメントの専門家",
        specialization: "スポーツテック・ファン体験・デジタルコンテンツ・放映権ビジネス",
        subSpecializations: ["スポーツデータ分析", "ファンエンゲージメント", "デジタル配信戦略"],
        informationSources: ["スポーツ業界レポート", "メディア技術動向", "エンターテインメント市場調査"],
        researchFocus: "2030年代のスポーツ体験革新とメディア産業変化"
      };
    }
    
    // Automotive & Manufacturing
    if (nameLower.includes('自動車') || nameLower.includes('製造') || nameLower.includes('工場') || nameLower.includes('生産')) {
      return {
        description: "自動車産業・製造業・Industry 4.0の専門家",
        specialization: "スマート工場・自動化・サプライチェーン・品質管理",
        subSpecializations: ["IoT製造システム", "ロボット自動化", "予測保全"],
        informationSources: ["製造業DX事例", "自動化技術動向", "サプライチェーン分析"],
        researchFocus: "2040年の完全自動化工場と製造業構造変革"
      };
    }
    
    // Healthcare & Medicine
    if (nameLower.includes('医療') || nameLower.includes('健康') || nameLower.includes('病院') || nameLower.includes('薬') || nameLower.includes('医師') || nameLower.includes('看護')) {
      return {
        description: "医療・ヘルスケア・デジタル医療の専門家",
        specialization: "テレメディシン・AI診断・個人化医療・予防医学",
        subSpecializations: ["遠隔医療システム", "AI医療画像解析", "予防・予測医療"],
        informationSources: ["医療技術学会", "デジタルヘルス動向", "規制・承認動向"],
        researchFocus: "2030年代の医療DXと個人化医療システム普及"
      };
    }
    
    // Education & Human Resources
    if (nameLower.includes('教育') || nameLower.includes('学習') || nameLower.includes('人事') || nameLower.includes('HR') || nameLower.includes('採用')) {
      return {
        description: "教育・人材開発・組織学習の専門家",
        specialization: "EdTech・スキル開発・リモート学習・人材戦略",
        subSpecializations: ["オンライン学習プラットフォーム", "スキルベース採用", "継続学習システム"],
        informationSources: ["教育技術研究", "人材開発トレンド", "労働市場分析"],
        researchFocus: "2040年の働き方変化と人材育成システム進化"
      };
    }
    
    // AI & Technology
    if (nameLower.includes('AI') || nameLower.includes('人工知能') || nameLower.includes('機械学習') || nameLower.includes('DX')) {
      return {
        description: "AI技術・機械学習応用・デジタル変革の専門家",
        specialization: "AI実装・データサイエンス・自動化技術・DX戦略",
        subSpecializations: ["機械学習モデル設計", "データパイプライン構築", "AI倫理・安全性"],
        informationSources: ["AI研究論文", "テクノロジーカンファレンス", "業界ベンチマーク"],
        researchFocus: "2030-2040年のAI社会実装と産業変革予測"
      };
    }
    
    // Data & Analytics
    if (nameLower.includes('データ') || nameLower.includes('アナリスト') || nameLower.includes('統計') || nameLower.includes('分析')) {
      return {
        description: "データ分析・予測モデリング・ビジネスインテリジェンスの専門家",
        specialization: "統計分析・予測モデル・データ戦略・意思決定支援",
        subSpecializations: ["予測分析モデル", "リアルタイムダッシュボード", "統計的因果推論"],
        informationSources: ["統計学会報告", "データサイエンス研究", "業界動向調査"],
        researchFocus: "2030年代のデータドリブン意思決定と自動化"
      };
    }
    
    // Marketing & Sales
    if (nameLower.includes('マーケティング') || nameLower.includes('営業') || nameLower.includes('販売') || nameLower.includes('広告')) {
      return {
        description: "デジタルマーケティング・顧客体験・ブランド戦略の専門家",
        specialization: "オムニチャネル戦略・パーソナライゼーション・ROI最適化",
        subSpecializations: ["顧客行動分析", "マルチタッチ・アトリビューション", "リアルタイム最適化"],
        informationSources: ["マーケティングテクノロジー動向", "消費者行動研究", "デジタル広告効果測定"],
        researchFocus: "2040年の消費者接点進化とブランド体験戦略"
      };
    }
    
    // Business Strategy & Management
    if (nameLower.includes('経営') || nameLower.includes('戦略') || nameLower.includes('コンサル') || nameLower.includes('社長') || nameLower.includes('CEO') || nameLower.includes('役員')) {
      return {
        description: "企業戦略・経営層意思決定・組織変革の専門家",
        specialization: "デジタル変革・組織レジリエンス・持続可能経営・事業戦略",
        subSpecializations: ["事業ポートフォリオ戦略", "組織アジリティ向上", "ステークホルダー価値創造"],
        informationSources: ["戦略コンサルティング研究", "組織行動学", "産業構造分析"],
        researchFocus: "2030-2050年の産業再編と企業の長期競争優位性構築"
      };
    }
    
    // Technology & Engineering
    if (nameLower.includes('技術') || nameLower.includes('エンジニア') || nameLower.includes('開発') || nameLower.includes('システム')) {
      return {
        description: "次世代技術・システム設計・インフラ構築の専門家",
        specialization: "クラウドネイティブ・セキュリティ・スケーラブル設計・技術戦略",
        subSpecializations: ["分散システム設計", "セキュリティアーキテクチャ", "パフォーマンス最適化"],
        informationSources: ["技術標準化団体", "オープンソースコミュニティ", "システム設計事例"],
        researchFocus: "2040年の技術基盤進化と企業システム戦略"
      };
    }
    
    // Finance & Economics
    if (nameLower.includes('金融') || nameLower.includes('投資') || nameLower.includes('経済') || nameLower.includes('財務') || nameLower.includes('銀行')) {
      return {
        description: "金融市場・投資戦略・経済動向・財務戦略の専門家",
        specialization: "フィンテック・デジタル資産・リスク管理・ESG投資",
        subSpecializations: ["暗号資産評価", "ESG投資戦略", "金融技術革新"],
        informationSources: ["中央銀行レポート", "金融市場データ", "フィンテック動向"],
        researchFocus: "2040年の金融システム変革と企業財務戦略"
      };
    }
    
    // Supply Chain & Logistics
    if (nameLower.includes('物流') || nameLower.includes('サプライ') || nameLower.includes('調達') || nameLower.includes('配送')) {
      return {
        description: "サプライチェーン・物流・調達戦略の専門家",
        specialization: "デジタル物流・自動化・トレーサビリティ・リスク管理",
        subSpecializations: ["物流自動化", "在庫最適化", "サプライチェーン可視化"],
        informationSources: ["物流業界レポート", "SCM技術動向", "貿易・関税動向"],
        researchFocus: "2030年代の自動化物流とグローバルサプライチェーン再構築"
      };
    }
    
    // Default for unrecognized expert types - more personalized
    const words = expertName.split(/[\s・\-_]+/).filter(w => w.length > 0);
    const lastWord = words[words.length - 1];
    
    return {
      description: `${lastWord}分野・業界動向・専門戦略の専門家`,
      specialization: "業界トレンド分析・競合戦略・イノベーション評価・市場予測",
      subSpecializations: [`${lastWord}業界分析`, "競合戦略研究", "新技術評価"],
      informationSources: [`${lastWord}業界レポート`, "市場調査データ", "専門誌・学会"],
      researchFocus: `2030-2050年の${lastWord}分野における技術・市場変化と戦略的機会`
    };
  }

  private getFallbackPrediction(expertName: string): ExpertPrediction {
    // Check for exact matches first
    const exactMatch = expertFallbackTemplates[expertName];
    if (exactMatch) {
      return exactMatch;
    }

    // Check for partial matches in expert name
    for (const [templateKey, template] of Object.entries(expertFallbackTemplates)) {
      if (expertName.includes(templateKey) || templateKey.includes(expertName)) {
        return {
          ...template,
          role: `${expertName} - ${template.role}`
        };
      }
    }

    // Enhanced generic fallback based on expert name analysis
    const genericRole = this.generateGenericRole(expertName);
    return {
      role: `${expertName} - ${genericRole.description}`,
      specialization: genericRole.specialization,
      expertiseLevel: "expert",
      subSpecializations: genericRole.subSpecializations,
      informationSources: genericRole.informationSources,
      researchFocus: genericRole.researchFocus
    };
  }

  async predictExpertInfo(expertName: string): Promise<ExpertPrediction> {
    const startTime = Date.now();
    
    console.log(`[ExpertPrediction] Request started for: ${expertName}`);

    // 1. Check cache first (fastest path)
    const cached = this.getCachedPrediction(expertName);
    if (cached) {
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] Cache hit for ${expertName} in ${elapsedTime}ms`);
      return cached;
    }

    // 2. Check inflight deduplication
    const existingRequest = inflightRequests.get(expertName);
    if (existingRequest) {
      console.log(`[ExpertPrediction] Joining inflight request for ${expertName}`);
      try {
        const result = await existingRequest;
        const elapsedTime = Date.now() - startTime;
        console.log(`[ExpertPrediction] Inflight request completed for ${expertName} in ${elapsedTime}ms`);
        return result;
      } catch (error) {
        // If inflight request failed, continue with new request
        console.log(`[ExpertPrediction] Inflight request failed for ${expertName}, trying new request`);
      }
    }

    // 3. Check circuit breaker (fast-fail on known failures)
    if (this.shouldBreakCircuit(expertName)) {
      const fallbackResult = this.getFallbackPrediction(expertName);
      this.cachePrediction(expertName, fallbackResult);
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] Circuit breaker fallback for ${expertName} in ${elapsedTime}ms`);
      return fallbackResult;
    }

    // 4. Create new API request with hard deadline enforcement
    const requestPromise = this.makeApiRequestWithDeadline(expertName, startTime);
    inflightRequests.set(expertName, requestPromise);

    try {
      const result = await requestPromise;
      
      // Success: cache result and clear inflight
      this.cachePrediction(expertName, result);
      inflightRequests.delete(expertName);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] API success for ${expertName} in ${elapsedTime}ms`);
      return result;
      
    } catch (error) {
      // Failure: record in circuit breaker, clear inflight, return fallback
      this.recordCircuitBreakerFailure(expertName, error);
      inflightRequests.delete(expertName);
      
      const fallbackResult = this.getFallbackPrediction(expertName);
      this.cachePrediction(expertName, fallbackResult);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] API error for ${expertName} after ${elapsedTime}ms, using fallback`);
      return fallbackResult;
    }
  }

  private async makeApiRequestWithDeadline(expertName: string, requestStartTime: number): Promise<ExpertPrediction> {
    const remainingTime = HARD_DEADLINE - (Date.now() - requestStartTime);
    if (remainingTime <= 100) { // Less than 100ms remaining
      throw new Error('Hard deadline exceeded before API call');
    }

    // Create AbortController for hard deadline enforcement
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, Math.min(remainingTime - 50, 10000)); // Leave 50ms buffer, max 10000ms

    try {
      const prompt = `あなたは「${expertName}」のプロフィールを設定する専門家です。この専門家は2030年、2040年、2050年の未来予測分析を行う重要な役割を担います。

**重要な背景:**
- この専門家は企業の未来戦略策定を支援する
- 2030年〜2050年の長期的視点での分析が必要
- 技術・社会・経済の変化を予測し、具体的な戦略提言を行う

**${expertName}の専門プロフィールを以下のJSON形式で詳細に設定してください:**

{
  "role": "未来予測分析における${expertName}の具体的役割と責任（専門性を明確に表現）",
  "specialization": "2030年〜2050年の予測に重要な主要専門分野（最新技術・トレンドを含む）",
  "expertiseLevel": "specialist/expert/senior のいずれか（未来予測の専門性レベル）",
  "subSpecializations": ["未来予測に必須の専門領域1", "新興技術・手法2", "戦略的分析手法3"],
  "informationSources": ["信頼できる専門情報源1", "最新動向を把握する情報源2"],
  "researchFocus": "2030年〜2050年の時間軸で企業が注目すべき具体的研究テーマ"
}

**設定指針:**
- 各フィールドは未来予測分析に実際に役立つ具体的内容にする
- 一般的ではなく、${expertName}固有の専門性を反映する
- 2030年以降の技術・社会変化を見据えた最新の専門知識を含める
- 企業戦略に直結する実用的な専門性を重視する

日本語で詳細かつ実用的な内容を回答してください。`;

      console.log(`[ExpertPrediction] Making API call for ${expertName} with ${remainingTime}ms remaining`);
      
      const response = await fastOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.3,
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseContent = response.choices[0].message.content || "{}";
      const result = JSON.parse(responseContent);
      
      // Validate and set defaults if needed
      return {
        role: result.role || "",
        specialization: result.specialization || "",
        expertiseLevel: ["specialist", "expert", "senior"].includes(result.expertiseLevel) 
          ? result.expertiseLevel 
          : "expert",
        subSpecializations: Array.isArray(result.subSpecializations) 
          ? result.subSpecializations 
          : [],
        informationSources: Array.isArray(result.informationSources) 
          ? result.informationSources 
          : [],
        researchFocus: result.researchFocus || "",
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Check if it's an abort error (our timeout) or API error
      if (controller.signal.aborted) {
        throw new Error('Request aborted due to hard deadline');
      }
      
      throw error;
    }
  }

  async analyzeWithExpert(
    expertName: string, 
    expertRole: string, 
    theme: string, 
    currentStrategy: string, 
    targetYear: number,
    analysisId?: string
  ): Promise<ExpertAnalysis> {
    try {
      const prompt = `あなたは「${expertName}」として、以下の分析を行ってください。

専門分野: ${expertRole}

分析対象:
- 未来テーマ: ${theme}
- 現在の経営戦略: ${currentStrategy}
- 予測年: ${targetYear}年

${expertName}の視点から、${targetYear}年における上記テーマの影響と、現在の経営戦略に対する専門的な助言を提供してください。
具体的な課題、機会、推奨事項を含めて分析してください。

JSON形式で以下の構造で回答してください:
{
  "analysis": "詳細な分析内容（500文字程度）",
  "recommendations": ["推奨事項1", "推奨事項2", "推奨事項3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 1, `専門家分析: ${expertName}`, prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 1, `専門家分析: ${expertName}`, true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      
      return {
        expert: expertName,
        content: result.analysis || "分析結果を取得できませんでした。",
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      console.error("Expert analysis error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 1, `専門家分析: ${expertName}`, false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return {
        expert: expertName,
        content: `${expertName}による分析中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        recommendations: [],
      };
    }
  }

  async generateScenario(
    theme: string,
    currentStrategy: string,
    targetYear: number,
    expertAnalyses: ExpertAnalysis[],
    analysisId?: string
  ): Promise<string> {
    try {
      const expertSummary = expertAnalyses.map(analysis => 
        `${analysis.expert}: ${analysis.content}`
      ).join('\n\n');

      const prompt = `以下の専門家分析を基に、${targetYear}年における具体的なシナリオを生成してください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
予測年: ${targetYear}年

専門家分析:
${expertSummary}

上記の分析を統合し、${targetYear}年に起こりうる具体的なシナリオを詳細に描写してください。
シナリオには以下を含めてください:
1. 社会・技術・経済環境の変化
2. 現在の戦略への影響
3. 企業が直面する課題と機会
4. 推奨される対応策

JSON形式で以下の構造で回答してください:
{
  "scenario": "詳細なシナリオ（800文字程度）"
}`;

      if (analysisId) {
        logApiRequest(analysisId, 2, "シナリオ生成", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 2, "シナリオ生成", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return result.scenario || "シナリオの生成に失敗しました。";
    } catch (error) {
      console.error("Scenario generation error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 2, "シナリオ生成", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return `シナリオ生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  }

  async generateLongTermPerspective(
    theme: string,
    currentStrategy: string,
    longTermYear: number,
    nearTermYear: number,
    analysisId?: string
  ): Promise<string> {
    try {
      const prompt = `${longTermYear}年の視点から${nearTermYear}年の戦略を評価し、超長期的な観点での提言を行ってください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
長期視点年: ${longTermYear}年
評価対象年: ${nearTermYear}年

${longTermYear}年から振り返って、${nearTermYear}年時点で重要になる要素と、現在取るべき戦略的アクションを分析してください。

JSON形式で以下の構造で回答してください:
{
  "perspective": "長期的な視点からの分析（600文字程度）",
  "key_factors": ["重要要素1", "重要要素2", "重要要素3"],
  "strategic_actions": ["戦略的アクション1", "戦略的アクション2", "戦略的アクション3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 3, "長期視点分析", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 3, "長期視点分析", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return result.perspective || "長期的視点の分析に失敗しました。";
    } catch (error) {
      console.error("Long-term perspective error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 3, "長期視点分析", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return `長期的視点の分析中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  }

  async evaluateStrategicAlignment(
    theme: string,
    currentStrategy: string,
    targetYear: number,
    scenarios: string[],
    analysisId?: string
  ): Promise<string> {
    try {
      const scenarioSummary = scenarios.join('\n\n');

      const prompt = `以下のシナリオ分析に基づいて、現在の経営戦略の整合性を評価してください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
予測年: ${targetYear}年

生成されたシナリオ:
${scenarioSummary}

現在の経営戦略がこれらのシナリオにどの程度適合しているか、また戦略修正の必要性について評価してください。

JSON形式で以下の構造で回答してください:
{
  "alignment_score": "1-10のスコア",
  "strengths": ["強み・機会1", "強み・機会2", "強み・機会3"],
  "weaknesses": ["課題・リスク1", "課題・リスク2", "課題・リスク3"],
  "recommendations": ["推奨事項1", "推奨事項2", "推奨事項3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 4, "戦略整合性評価", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 4, "戦略整合性評価", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return JSON.stringify(result);
    } catch (error) {
      console.error("Strategic alignment evaluation error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 4, "戦略整合性評価", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return JSON.stringify({
        alignment_score: "評価不可",
        strengths: ["評価中にエラーが発生しました"],
        weaknesses: [error instanceof Error ? error.message : "不明なエラー"],
        recommendations: ["後で再度実行してください"]
      });
    }
  }

  async generateFinalSimulation(
    theme: string,
    currentStrategy: string,
    targetYear: number,
    allAnalyses: string[],
    analysisId?: string
  ): Promise<string> {
    try {
      const analysisSummary = allAnalyses.join('\n\n');

      const prompt = `これまでの全ての分析を統合し、最終的なシナリオシミュレーションを生成してください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
予測年: ${targetYear}年

統合分析:
${analysisSummary}

上記の全分析を統合し、最も実現可能性の高い未来シナリオと、企業が取るべき具体的な戦略を提示してください。

JSON形式で以下の構造で回答してください:
{
  "final_scenario": "最終統合シナリオ（800文字程度）",
  "strategic_priorities": ["優先戦略1", "優先戦略2", "優先戦略3"],
  "success_factors": ["成功要因1", "成功要因2", "成功要因3"],
  "implementation_steps": ["実装ステップ1", "実装ステップ2", "実装ステップ3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 5, "最終シミュレーション", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 5, "最終シミュレーション", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return result.final_scenario || "最終シミュレーションの生成に失敗しました。";
    } catch (error) {
      console.error("Final simulation error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 5, "最終シミュレーション", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return `最終シミュレーション中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  }

  generateMarkdownReport(
    theme: string,
    currentStrategy: string,
    targetYears: number[],
    phases: PhaseResult[]
  ): string {
    const date = new Date().toISOString().split('T')[0];
    
    let markdown = `# 未来予測AIシナリオ分析レポート

**生成日:** ${date}
**分析テーマ:** ${theme}
**現在の経営戦略:** ${currentStrategy}
**予測年:** ${targetYears.join(', ')}

---

## 📋 エグゼクティブサマリー

本レポートは、AI専門家エージェントによる未来予測分析の結果をまとめたものです。
複数の専門家の視点を統合し、${targetYears[0]}年を中心とした未来シナリオを分析しました。

---

`;

    phases.forEach((phase, index) => {
      markdown += `## Phase ${index + 1}: ${phase.title}\n\n`;
      markdown += `${phase.content}\n\n`;

      if (phase.analyses && phase.analyses.length > 0) {
        markdown += `### 専門家分析\n\n`;
        phase.analyses.forEach(analysis => {
          markdown += `#### ${analysis.expert}\n\n`;
          markdown += `${analysis.content}\n\n`;
          if (analysis.recommendations.length > 0) {
            markdown += `**推奨事項:**\n`;
            analysis.recommendations.forEach(rec => {
              markdown += `- ${rec}\n`;
            });
            markdown += `\n`;
          }
        });
      }

      if (phase.recommendations && phase.recommendations.length > 0) {
        markdown += `### 主要推奨事項\n\n`;
        phase.recommendations.forEach(rec => {
          markdown += `- ${rec}\n`;
        });
        markdown += `\n`;
      }

      markdown += `---\n\n`;
    });

    markdown += `## 🎯 総合提言

このレポートに基づき、以下の戦略的アプローチを推奨します：

1. **短期的施策（1-2年）:** 現在の戦略の強化と基盤整備
2. **中期的施策（3-5年）:** 新技術・新市場への適応準備
3. **長期的施策（5年以上）:** 持続可能な競争優位の構築

---

*このレポートは AI 専門家エージェントシステムにより生成されました。*
`;

    return markdown;
  }

  generateMarkdownReportMultiYear(
    theme: string,
    currentStrategy: string,
    targetYears: number[],
    yearResults: YearResult[]
  ): string {
    const date = new Date().toISOString().split('T')[0];
    
    let markdown = `# 未来予測AIシナリオ分析レポート（複数年予測）

**生成日:** ${date}
**分析テーマ:** ${theme}
**現在の経営戦略:** ${currentStrategy}
**予測年:** ${targetYears.join(', ')}

---

## 📋 エグゼクティブサマリー

本レポートは、AI専門家エージェントによる複数年にわたる未来予測分析の結果をまとめたものです。
${targetYears.map(year => `${year}年`).join('、')}における未来シナリオを、段階的に分析しています。

---

## 📊 年別分析結果インデックス

`;

    yearResults.forEach(yearResult => {
      markdown += `- [${yearResult.year}年の分析](#${yearResult.year}年の未来予測シナリオ)
`;
    });

    markdown += `
---

`;

    // Generate content for each year
    yearResults.forEach((yearResult, yearIndex) => {
      markdown += `## ${yearResult.year}年の未来予測シナリオ

`;
      
      yearResult.phases.forEach((phase, phaseIndex) => {
        markdown += `### Phase ${phaseIndex + 1}: ${phase.title}

`;
        markdown += `${phase.content}

`;

        if (phase.analyses && phase.analyses.length > 0) {
          markdown += `#### 専門家分析

`;
          phase.analyses.forEach(analysis => {
            markdown += `##### ${analysis.expert}

`;
            markdown += `${analysis.content}

`;
            if (analysis.recommendations.length > 0) {
              markdown += `**推奨事項:**
`;
              analysis.recommendations.forEach(rec => {
                markdown += `- ${rec}
`;
              });
              markdown += `
`;
            }
          });
        }

        if (phase.recommendations && phase.recommendations.length > 0) {
          markdown += `#### 主要推奨事項

`;
          phase.recommendations.forEach(rec => {
            markdown += `- ${rec}
`;
          });
          markdown += `
`;
        }
      });

      if (yearIndex < yearResults.length - 1) {
        markdown += `---

`;
      }
    });

    markdown += `---

## 🎯 複数年総合提言

この複数年分析に基づき、以下の段階的戦略アプローチを推奨します：

`;

    targetYears.forEach((year, index) => {
      const timeframe = index === 0 ? '短期的施策' : index === 1 ? '中期的施策' : '長期的施策';
      markdown += `${index + 1}. **${timeframe}（${year}年目標）:** 段階的な戦略展開と適応
`;
    });

    markdown += `
---

*このレポートは AI 専門家エージェントシステムにより生成されました。*
`;

    return markdown;
  }
}

export const openAIService = new OpenAIService();
