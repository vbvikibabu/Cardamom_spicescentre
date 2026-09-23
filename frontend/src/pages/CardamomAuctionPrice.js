import { useDocumentHead } from '@/hooks/useDocumentHead';
import MarketRatesPanel from '@/components/MarketRatesPanel';

const CardamomAuctionPrice = () => {
  useDocumentHead({
    title: 'Cardamom Auction Price — Daily Rates | Cardamom Spices Centre',
    description: 'Small cardamom auction prices from Spices Board e-auctions, updated daily, with the 30-day trend.',
    path: '/cardamom-auction-price',
  });

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-20 md:pb-0 pt-32">
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-4">
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1a3a1a]">Cardamom Auction Price</h1>
        <p className="font-serif text-lg text-[#2d5a27] mt-1">ஏலக்காய் ஏல விலை</p>
        <p className="text-gray-600 max-w-2xl mt-4 leading-relaxed">
          These are previous-day auction prices for small cardamom, published by the
          Spices Board of India. Prices vary sharply by grade — larger, bolder pods
          command more than smaller or split lots, and the spread between each day's
          low and high below shows how much. Share your required grade and quantity
          to get a price.
        </p>
      </section>

      <MarketRatesPanel />
    </div>
  );
};

export default CardamomAuctionPrice;
