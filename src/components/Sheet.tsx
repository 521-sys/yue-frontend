import { X, Volume2, BookMarked, Trash2 } from "lucide-react";
import { WORDS, Word, shortMan } from "../data/words";
import { speak } from "../lib/speech";
import { useLearning, removeStuck } from "../lib/store";

/** 通用底部抽屉容器 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-[#f0f4ff] rounded-t-3xl flex flex-col max-h-[88vh] animate-sheet-up overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
          <span className="font-bold text-lg text-[#1a1a2e]">{title}</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-8">{children}</div>
      </div>
    </div>
  );
}

/** 发音按钮 */
export function SoundButton({
  text,
  size = 20,
  className = "",
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  return (
    <button
      onClick={() => speak(text)}
      className={`flex items-center justify-center rounded-full bg-[#EEF3FF] active:scale-90 transition-transform ${className}`}
    >
      <Volume2 size={size} className="text-[#2B5CE6]" />
    </button>
  );
}

/** 单词行（可选删除按钮） */
export function WordRow({
  w,
  onRemove,
  showExample = false,
}: {
  w: Word;
  onRemove?: (id: string) => void;
  showExample?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm shadow-blue-50">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2B5CE6] to-[#4a7cf7] flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-lg">{w.yue}</span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[#2B5CE6] text-sm font-mono font-medium">{w.jyut}</span>
        <div className="text-gray-500 text-xs truncate">{shortMan(w.man)}</div>
        {showExample && <div className="text-gray-400 text-[11px] mt-0.5 truncate">{w.example}</div>}
      </div>
      <SoundButton text={w.yue} size={16} className="w-9 h-9 flex-shrink-0" />
      {onRemove && (
        <button
          onClick={() => onRemove(w.id)}
          className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          title="移出生词本"
        >
          <Trash2 size={16} className="text-red-400" />
        </button>
      )}
    </div>
  );
}

/** 生词本内容（含空状态） */
export function StuckList() {
  const s = useLearning();
  const words = WORDS.filter((w) => s.stuck.includes(w.id));
  return (
    <>
      {words.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF3FF] flex items-center justify-center">
            <BookMarked size={28} className="text-[#2B5CE6]" />
          </div>
          <p className="text-gray-500 text-sm">生词本是空的</p>
          <p className="text-gray-400 text-xs">记粤语选错、背粤语「再背一次」的词会收进来</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400">共 {words.length} 个生词 · 点垃圾桶移出</p>
          {words.map((w) => (
            <WordRow key={w.id} w={w} onRemove={removeStuck} />
          ))}
        </div>
      )}
    </>
  );
}
