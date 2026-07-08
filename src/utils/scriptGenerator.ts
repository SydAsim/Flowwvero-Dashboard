import type { Lead } from '../types/lead';

export interface GeneratedScript {
  opening: string;
  reason: string;
  personalizedLine: string;
  painPoint: string;
  offer: string;
  callToAction: string;
  fullScript: string;
  shortVersion: string;
  smsFollowUp: string;
  emailFollowUp: string;
  objectionHandling: Record<string, string>;
}

export function generateLeadScript(lead: Lead): GeneratedScript {
  const name = lead.businessName || 'there';
  const niche = lead.category || 'your business';
  const location = lead.address ? lead.address.split(',')[1]?.trim() || lead.address : 'your local area';
  const ratingText = lead.rating ? `with a solid ${lead.rating} star rating` : '';
  const reviewsText = lead.reviewCount ? `and ${lead.reviewCount} customer reviews` : '';
  
  const opening = `Hi, is this the manager or owner of ${name}? Hey there, this is Flowvero calling. How’s your week going?`;
  
  const reason = `The reason for my call is we were looking at top-rated ${niche} providers in ${location} ${ratingText}, and wanted to speak with whoever handles your patient/customer operations.`;
  
  const personalizedLine = `I noticed you have a great reputation on Google Maps ${reviewsText}. Usually, top-notch operators like you are quite busy but sometimes lose out on inbound leads if the receptionist is occupied or phones are busy.`;
  
  const painPoint = `Many ${niche} businesses we work with struggle to capture 100% of missed calls, costing them thousands of dollars in lost monthly revenue.`;
  
  const offer = `At Flowvero, we specialize in Low Patient-Flow Workflow Automation. We deploy an AI voice assistant that automatically answers missed calls, books appointments directly into your calendar, and handles patient inquiries 24/7.`;
  
  const callToAction = `I was wondering, do you have 10-15 minutes next Tuesday or Wednesday for a quick Zoom walkthrough to see if we can save you 10+ hours a week and boost bookings by 30%?`;

  const fullScript = `[Intro / Opening]\n${opening}\n\n[Reason for Calling]\n${reason}\n\n[Personalization]\n${personalizedLine}\n\n[The Pain Point]\n${painPoint}\n\n[Our Offer]\n${offer}\n\n[Call To Action / Close]\n${callToAction}`;

  const shortVersion = `Hey! This is Flowvero. We build AI assistants for ${niche} teams that automatically handle missed calls and schedule bookings 24/7 so you never lose a client. I saw you're one of the top profiles in ${location}. Do you have 10 minutes next week to see a quick demo?`;

  const smsFollowUp = `Hi ${name} team! This is Flowvero. Tried calling earlier about setting up a missed-call booking assistant for your ${niche} business. Many local spots save 10+ hours/week. Watch a 2min demo here: flowvero.com/demo or reply to chat!`;

  const emailFollowUp = `Subject: Missed calls costing ${name} bookings? 

Hi team,

I tried calling you earlier today. I noticed you are one of the top-rated ${niche} providers in ${location}. 

We help businesses like yours implement Low Patient-Flow Automation to:
1. Automatically text back missed calls immediately.
2. Book appointments 24/7 directly into your software.
3. Answer common patient questions without staff intervention.

Would you be open to a brief 10-minute Zoom call next week to see how this can increase your bookings?

Best regards,
Syed
Flowvero Automation`;

  const objectionHandling = {
    "Not interested": "I completely understand. Many of our current clients said the same thing before seeing how our AI assistant runs in the background to capture leads they didn't even know they were missing. If you ever change your mind, feel free to reach out.",
    "Already have a solution": "That’s awesome! It means you understand how important this is. What are you currently using? Our platform usually integrates directly with your existing software and cuts receptionist workloads by 50% at a fraction of the cost.",
    "Send an email first": "I'd be happy to. What is the best email address to send that to? I'll send over a 2-minute overview video, and follow up next week to see what you think.",
    "We are too busy": "Totally get it, which is exactly why we called! Our automated setup takes less than 30 minutes of your time, and then runs entirely on autopilot to save your staff hours of phone work every single day."
  };

  return {
    opening,
    reason,
    personalizedLine,
    painPoint,
    offer,
    callToAction,
    fullScript,
    shortVersion,
    smsFollowUp,
    emailFollowUp,
    objectionHandling
  };
}
