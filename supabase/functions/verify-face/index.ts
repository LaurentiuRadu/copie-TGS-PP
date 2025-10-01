import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationLog {
  user_id: string;
  time_entry_id?: string;
  verification_type: 'enrollment' | 'clock_in' | 'clock_out';
  photo_url: string;
  quality_score?: number;
  match_score?: number;
  is_match?: boolean;
  is_quality_pass: boolean;
  failure_reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { referenceImage, currentImage, action, userId, timeEntryId, photoUrl } = await req.json();

    if (!currentImage) {
      return new Response(
        JSON.stringify({ error: "Missing currentImage" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For enrollment, just check photo quality
    if (action === 'enroll') {
      console.log("Checking photo quality for enrollment");
      
      const qualityResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Verifică calitatea foto: fața clară, vizibilă, bine luminată, nu blurată. JSON: {"quality": "good"|"poor", "score": 0-100, "reason": "scurt"}`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: currentImage
                  }
                }
              ]
            }
          ]
        }),
      });

      if (!qualityResponse.ok) {
        const errorText = await qualityResponse.text();
        console.error("AI quality check error:", qualityResponse.status, errorText);
        
        if (userId && photoUrl) {
          await logVerification(supabaseClient, {
            user_id: userId,
            verification_type: 'enrollment',
            photo_url: photoUrl,
            is_quality_pass: false,
            failure_reason: 'AI quality check failed'
          });
        }
        
        throw new Error("Failed to check photo quality");
      }

      const qualityData = await qualityResponse.json();
      const content = qualityData.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error("No response from AI");
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response:", content);
        throw new Error("Invalid AI response format");
      }

      const result = JSON.parse(jsonMatch[0]);
      console.log("Quality check result:", result);

      const isValid = result.quality === 'good' && result.score >= 70;

      // Log enrollment
      if (userId && photoUrl) {
        await logVerification(supabaseClient, {
          user_id: userId,
          verification_type: 'enrollment',
          photo_url: photoUrl,
          quality_score: result.score / 100,
          is_quality_pass: isValid,
          failure_reason: !isValid ? result.reason : undefined
        });
      }

      return new Response(
        JSON.stringify({
          isValid,
          quality: result.quality,
          score: result.score,
          reason: result.reason
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For verification, compare faces
    if (!referenceImage) {
      return new Response(
        JSON.stringify({ error: "Missing referenceImage for verification" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Comparing faces for verification");

    const verifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: `Compară cele 2 fotografii - aceeași persoană? Analizează: trăsături faciale, calitate foto, similaritate. JSON: {"match": true|false, "confidence": 0-100, "quality": "good"|"poor", "reason": "scurt"}
            
            Ref: ${referenceImage}
            Curent: ${currentImage}`
          }
        ]
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error("AI verification error:", verifyResponse.status, errorText);
      
      if (userId && photoUrl) {
        await logVerification(supabaseClient, {
          user_id: userId,
          time_entry_id: timeEntryId,
          verification_type: action === 'verify' ? 'clock_in' : 'clock_out',
          photo_url: photoUrl,
          is_quality_pass: false,
          failure_reason: 'AI verification failed'
        });
      }
      
      throw new Error("Failed to verify face");
    }

    const verifyData = await verifyResponse.json();
    const content = verifyData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", content);
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log("Verification result:", result);

    const isValid = result.match && result.confidence >= 70 && result.quality === 'good';

    // Log verification
    if (userId && photoUrl) {
      await logVerification(supabaseClient, {
        user_id: userId,
        time_entry_id: timeEntryId,
        verification_type: action === 'verify' ? 'clock_in' : 'clock_out',
        photo_url: photoUrl,
        quality_score: result.quality === 'good' ? 0.8 : 0.4,
        match_score: result.confidence / 100,
        is_match: result.match,
        is_quality_pass: result.quality === 'good',
        failure_reason: !isValid ? result.reason : undefined
      });
    }

    return new Response(
      JSON.stringify({
        isValid,
        match: result.match,
        confidence: result.confidence,
        quality: result.quality,
        reason: result.reason
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in verify-face function:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function logVerification(supabase: any, log: VerificationLog) {
  try {
    const { error } = await supabase
      .from('face_verification_logs')
      .insert(log);
    
    if (error) {
      console.error('Error logging verification:', error);
    }
  } catch (err) {
    console.error('Failed to log verification:', err);
  }
}
