'use client';

import { useState } from 'react';

export default function OfferComparison({ offers }: { offers: any[] }) {
  const [selectedOffers, setSelectedOffers] = useState<any[]>([]);

  const handleDragStart = (e: React.DragEvent, offer: any) => {
    e.dataTransfer.setData('offer', JSON.stringify(offer));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const offerStr = e.dataTransfer.getData('offer');
    if (offerStr) {
      const offer = JSON.parse(offerStr);
      if (!selectedOffers.find(o => o.lender === offer.lender)) {
        if (selectedOffers.length < 3) {
           setSelectedOffers([...selectedOffers, offer]);
        } else {
           alert("You can compare up to 3 offers at a time.");
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeOffer = (lender: string) => {
    setSelectedOffers(selectedOffers.filter(o => o.lender !== lender));
  };

  return (
    <div className="mt-8 space-y-6">
      <h3 className="ivy-font text-xl font-extrabold text-foreground tracking-tight">Compare Offers</h3>
      <p className="text-sm text-muted-foreground">Drag and drop offers here to compare them side-by-side.</p>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Available Offers to Drag */}
        <div className="w-1/3 min-w-[250px] space-y-3 bg-muted/10 p-4 rounded-xl border border-border/30 h-[500px] overflow-y-auto">
          <h4 className="font-bold text-sm text-foreground mb-3">Available Offers</h4>
          {offers.filter(o => !selectedOffers.find(so => so.lender === o.lender)).map(offer => (
            <div
              key={offer.lender}
              draggable
              onDragStart={(e) => handleDragStart(e, offer)}
              className="cursor-move rounded-lg border border-border/50 bg-card p-3 shadow-sm hover:border-emerald-500/50 transition-colors"
            >
              <h5 className="font-bold text-foreground text-sm">{offer.lender}</h5>
              <p className="text-xs text-muted-foreground mt-1">Rate: {offer.interestRateMin}% - {offer.interestRateMax}%</p>
            </div>
          ))}
        </div>

        {/* Drop Zone / Comparison Table */}
        <div 
          onDrop={handleDrop} 
          onDragOver={handleDragOver}
          className={`flex-1 rounded-xl border-2 border-dashed ${selectedOffers.length > 0 ? 'border-border/30 bg-card/50' : 'border-emerald-500/30 bg-emerald-500/5'} p-6 min-h-[500px] flex gap-4 overflow-x-auto`}
        >
          {selectedOffers.length === 0 ? (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground text-sm font-semibold">
              Drop offers here to compare (Max 3)
            </div>
          ) : (
            selectedOffers.map(offer => (
              <div key={offer.lender} className="flex-1 min-w-[250px] bg-card rounded-xl border border-border/50 p-5 relative shadow-sm">
                <button onClick={() => removeOffer(offer.lender)} className="absolute top-3 right-3 text-muted-foreground hover:text-rose-500">
                  ✕
                </button>
                <h4 className="text-lg font-black text-foreground mb-4 pr-6">{offer.lender}</h4>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Interest Rate</p>
                    <p className="text-sm font-semibold">{offer.interestRateMin}% - {offer.interestRateMax}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Max Amount</p>
                    <p className="text-sm font-semibold">₹{(offer.maxLoanAmountINR / 100000).toFixed(2)} Lakhs</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Collateral</p>
                    <p className={`text-sm font-semibold ${offer.collateralRequired ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {offer.collateralRequired ? 'Required' : 'Not Required'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Moratorium</p>
                    <p className="text-sm font-semibold">{offer.moratoriumMonths} Months</p>
                  </div>
                  
                  <div className="pt-4 border-t border-border/30">
                    <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider mb-2">Pros</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {offer.prosAndCons?.pros?.map((p: string, i: number) => <li key={i}>✓ {p}</li>) || <li>No pros listed</li>}
                    </ul>
                  </div>
                  
                  <div className="pt-4 border-t border-border/30">
                    <p className="text-[10px] uppercase font-bold text-rose-500 tracking-wider mb-2">Cons</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {offer.prosAndCons?.cons?.map((p: string, i: number) => <li key={i}>✕ {p}</li>) || <li>No cons listed</li>}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
