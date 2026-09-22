import { useState, useCallback } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DrawingAnalysis } from '@/types/cad.types';
import { getMetraClientId } from '@/lib/client-identity';

export interface CADAnalysisState {
  isAnalyzing: boolean;
  error: string | null;
  analysis: DrawingAnalysis | null;
}

export const useCADAnalysis = (options: any = {}) => {
  const { onSuccess, onError } = options;
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const analyzeUploadedDrawing = useAction(api.actions.analyzeDrawing.analyzeUploadedDrawing);

  const [state, setState] = useState<CADAnalysisState>({
    isAnalyzing: false,
    error: null,
    analysis: null,
  });

  const analyzeDrawing = useCallback(
    async (file: File, cadModelData?: any, userId?: string) => {
      setState({
        isAnalyzing: true,
        error: null,
        analysis: null,
      });

      try {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File size exceeds the 10MB limit');
        }

        // Upload directly to Convex Storage. Passing file bytes through a
        // function argument would exceed Convex's argument-size limit.
        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload drawing');
        }
        const { storageId } = await uploadResponse.json();
        const clientId = getMetraClientId(userId);
        const analysis = await analyzeUploadedDrawing({
          storageId,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          clientId,
          rateLimitKey: clientId,
          cadModelData,
        }) as DrawingAnalysis;

        setState({
          isAnalyzing: false,
          error: null,
          analysis,
        });

        onSuccess?.(analysis);
        return analysis;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to analyze';
        setState({
          isAnalyzing: false,
          error: errorMessage,
          analysis: null,
        });
        onError?.(errorMessage);
        throw error;
      }
    },
    [analyzeUploadedDrawing, generateUploadUrl, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setState({
      isAnalyzing: false,
      error: null,
      analysis: null,
    });
  }, []);

  return {
    ...state,
    analyzeDrawing,
    reset,
  };
};





