import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { referenceImage, currentImage, action } = await req.json();

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
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analizează calitatea acestei fotografii pentru recunoaștere facială. 
                  Verifică:
                  1. Dacă fața este clară și vizibilă
                  2. Dacă lumina este suficientă (nu prea întunecată)
                  3. Dacă nu este blurată
                  4. Dacă persoana privește spre cameră
                  
                  Răspunde DOAR cu un JSON în formatul: {"quality": "good"|"poor", "score": 0-100, "reason": "explicatie scurta"}
                  Nu adăuga text suplimentar.`
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

      return new Response(
        JSON.stringify({
          isValid: result.quality === 'good' && result.score >= 70,
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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Compară cele două fotografii și determină dacă sunt aceeași persoană.
                Prima imagine este imaginea de referință înrolată.
                A doua imagine este imaginea curentă pentru verificare.
                
                Analizează:
                1. Trăsăturile faciale (ochi, nas, gură, formă față)
                2. Dacă calitatea imaginii curente este suficientă
                3. Similaritatea generală
                
                Răspunde DOAR cu un JSON în formatul: {"match": true|false, "confidence": 0-100, "quality": "good"|"poor", "reason": "explicatie scurta"}
                Nu adăuga text suplimentar.`
              },
              {
                type: "image_url",
                image_url: {
                  url: referenceImage
                }
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

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error("AI verification error:", verifyResponse.status, errorText);
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

    return new Response(
      JSON.stringify({
        isValid: result.match && result.confidence >= 70 && result.quality === 'good',
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