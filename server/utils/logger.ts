import { sseConnections } from "../sse";

export interface AnalysisLog {
  timestamp: string;
  analysisId: string;
  phase: number;
  action: 'api_request' | 'api_response' | 'phase_start' | 'phase_complete' | 'error';
  message: string;
  data?: any;
}

export function sendAnalysisLog(analysisId: string, log: Omit<AnalysisLog, 'timestamp' | 'analysisId'>) {
  const res = sseConnections.get(analysisId);
  if (res && !res.destroyed) {
    const fullLog: AnalysisLog = {
      timestamp: new Date().toISOString(),
      analysisId,
      ...log
    };
    
    const data = `data: ${JSON.stringify({
      type: 'analysis_log',
      data: fullLog
    })}\n\n`;
    
    try {
      res.write(data);
    } catch (error) {
      console.error(`Failed to send SSE to analysis ${analysisId}:`, error);
      sseConnections.delete(analysisId);
    }
  }
}

export function logApiRequest(analysisId: string, phase: number, endpoint: string, prompt: string) {
  sendAnalysisLog(analysisId, {
    phase,
    action: 'api_request',
    message: `OpenAI API リクエスト送信: ${endpoint}`,
    data: {
      endpoint,
      promptLength: prompt.length,
      model: "gpt-5"
    }
  });
}

export function logApiResponse(analysisId: string, phase: number, endpoint: string, success: boolean, responseLength?: number, error?: string) {
  sendAnalysisLog(analysisId, {
    phase,
    action: 'api_response',
    message: success 
      ? `OpenAI API レスポンス受信完了: ${endpoint} (${responseLength} 文字)`
      : `OpenAI API エラー: ${endpoint} - ${error}`,
    data: {
      endpoint,
      success,
      responseLength,
      error
    }
  });
}

export function logPhaseStart(analysisId: string, phase: number, phaseName: string) {
  sendAnalysisLog(analysisId, {
    phase,
    action: 'phase_start',
    message: `フェーズ ${phase} 開始: ${phaseName}`
  });
}

export function logPhaseComplete(analysisId: string, phase: number, phaseName: string) {
  sendAnalysisLog(analysisId, {
    phase,
    action: 'phase_complete',
    message: `フェーズ ${phase} 完了: ${phaseName}`
  });
}

export function logError(analysisId: string, errorMessage: string) {
  sendAnalysisLog(analysisId, {
    phase: 0, // Generic error phase
    action: 'error',
    message: errorMessage
  });
}

export function logDebug(analysisId: string, debugMessage: string) {
  sendAnalysisLog(analysisId, {
    phase: 0, // Debug phase
    action: 'phase_complete', // Use phase_complete action to ensure visibility
    message: `DEBUG: ${debugMessage}`
  });
}