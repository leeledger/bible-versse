import React, { useState, useEffect } from 'react';
import { AVAILABLE_BOOKS } from '../constants';
import { BookChapterInfo } from '../types'; 

interface ChapterSelectorProps {
  onStartReading: (book: string, startChapter: number, endChapter: number) => void;
  defaultBook?: string;
  initialSelection?: { book: string; chapter: number };
  completedChapters?: string[];
}

const ChapterSelector: React.FC<ChapterSelectorProps> = ({ 
    onStartReading, 
    defaultBook = "창세기",
    initialSelection,
    completedChapters = [],
}) => {
  const [selectedBookName, setSelectedBookName] = useState<string>(defaultBook);
  const [selectedBookInfo, setSelectedBookInfo] = useState<BookChapterInfo | undefined>(
    AVAILABLE_BOOKS.find(b => b.name === defaultBook)
  );
  const [startChapter, setStartChapter] = useState<number>(1);
  const [endChapter, setEndChapter] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const [dataAvailableForBook, setDataAvailableForBook] = useState<boolean>(false);
  const [alreadyReadMessage, setAlreadyReadMessage] = useState<string>('');

  useEffect(() => {
    let bookNameToSet = defaultBook;
    // Try to use initialSelection if provided and valid
    if (initialSelection && initialSelection.book && initialSelection.chapter > 0) {
      const initialBookData = AVAILABLE_BOOKS.find(b => b.name === initialSelection.book);
      if (initialBookData && initialBookData.chapterCount > 0 && initialSelection.chapter <= initialBookData.chapterCount) {
        bookNameToSet = initialSelection.book;
      }
    }
    setSelectedBookName(bookNameToSet);
  }, [initialSelection, defaultBook]);


  useEffect(() => {
    const bookInfo = AVAILABLE_BOOKS.find(b => b.name === selectedBookName);
    setSelectedBookInfo(bookInfo);

    if (bookInfo && bookInfo.chapterCount > 0) {
      setDataAvailableForBook(true);
      let chapterToSet = 1;
      // If initialSelection is for the current selectedBookName and is valid, use it
      if (initialSelection && initialSelection.book === selectedBookName && initialSelection.chapter > 0 && initialSelection.chapter <= bookInfo.chapterCount) {
        chapterToSet = initialSelection.chapter;
      }
      setStartChapter(chapterToSet);
      setEndChapter(chapterToSet); // Default end chapter to the same as start for "resume"
      setError('');
    } else {
      setDataAvailableForBook(false);
      setStartChapter(1); // Reset, will be disabled
      setEndChapter(1);   // Reset, will be disabled
      if (bookInfo) { 
          setError(`"${selectedBookName}" 책의 성경 데이터가 아직 준비되지 않았습니다. (다른 책을 선택해주세요.)`);
      } else {
          setError(`"${selectedBookName}" 책을 찾을 수 없습니다. 목록에서 올바른 책을 선택해주세요.`);
      }
    }
  }, [selectedBookName, initialSelection]);


  useEffect(() => {
    if (selectedBookInfo && selectedBookInfo.chapterCount > 0) {
        // Ensure startChapter is within bounds
        if (startChapter > selectedBookInfo.chapterCount) {
            setStartChapter(selectedBookInfo.chapterCount);
        } else if (startChapter < 1) {
            setStartChapter(1);
        }
        // Ensure endChapter is within bounds
        if (endChapter > selectedBookInfo.chapterCount) {
            setEndChapter(selectedBookInfo.chapterCount);
        } else if (endChapter < 1) {
            setEndChapter(1);
        }
        // Ensure endChapter is not less than startChapter
        if (endChapter < startChapter) {
            setEndChapter(startChapter);
        }
    }
  }, [startChapter, endChapter, selectedBookInfo]);

  useEffect(() => {
    if (!selectedBookInfo || !completedChapters) {
      setAlreadyReadMessage('');
      return;
    }

    let message = '';
    for (let ch = startChapter; ch <= endChapter; ch++) {
      const chapterKey = `${selectedBookName}:${ch}`;
      if (completedChapters.includes(chapterKey)) {
        message = "선택한 범위에 이미 읽은 장이 포함되어 있습니다.";
        break;
      }
    }
    setAlreadyReadMessage(message);
  }, [selectedBookName, startChapter, endChapter, completedChapters, selectedBookInfo]);


  const handleStart = () => {
    if (!selectedBookInfo || selectedBookInfo.chapterCount === 0) {
      setError(`"${selectedBookName}" 책의 내용을 읽을 수 없습니다. 데이터가 준비되지 않았습니다.`);
      return;
    }
    if (startChapter <= 0 || endChapter <= 0) {
      setError("장은 1 이상이어야 합니다.");
      return;
    }
    if (startChapter > selectedBookInfo.chapterCount || endChapter > selectedBookInfo.chapterCount) {
      setError(`선택한 책의 최대 장은 ${selectedBookInfo.chapterCount}장입니다.`);
      return;
    }
    if (startChapter > endChapter) {
      setError("시작 장은 종료 장보다 클 수 없습니다.");
      return;
    }
    setError('');
    onStartReading(selectedBookName, startChapter, endChapter);
  };

  const renderChapterWarning = () => {
    if (alreadyReadMessage) {
      return (
        <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded-md text-center">
          {alreadyReadMessage}
        </p>
      );
    }
    return null;
  };

  const chapterOptions = (maxChapter: number) => {
    if (maxChapter === 0) return [<option key="0-na" value="0" disabled>N/A</option>];
    return Array.from({ length: maxChapter }, (_, i) => i + 1).map(ch => (
      <option key={ch} value={ch}>{ch}장</option>
    ));
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-lg space-y-4">
      <h3 className="text-xl font-semibold text-gray-800 text-center">읽을 범위 선택</h3>
      
      <div>
        <label htmlFor="book-select" className="block text-sm font-medium text-gray-700">성경:</label>
        <select
          id="book-select"
          value={selectedBookName}
          onChange={(e) => setSelectedBookName(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          {AVAILABLE_BOOKS.map(book => (
            <option key={book.name} value={book.name}>{book.name}</option>
          ))}
        </select>
      </div>

      {renderChapterWarning()}
      
      {/* Chapter selectors are always rendered but may be disabled */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-chapter" className="block text-sm font-medium text-gray-700">시작 장:</label>
          <select
            id="start-chapter"
            value={startChapter}
            onChange={(e) => setStartChapter(parseInt(e.target.value))}
            disabled={!dataAvailableForBook}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
          >
            {chapterOptions(selectedBookInfo?.chapterCount ?? 0)}
          </select>
        </div>
        <div>
          <label htmlFor="end-chapter" className="block text-sm font-medium text-gray-700">종료 장:</label>
          <select
            id="end-chapter"
            value={endChapter}
            onChange={(e) => setEndChapter(parseInt(e.target.value))}
            disabled={!dataAvailableForBook}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
          >
            {chapterOptions(selectedBookInfo?.chapterCount ?? 0)}
          </select>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
      
      <button
        onClick={handleStart}
        disabled={!selectedBookInfo || !dataAvailableForBook || startChapter <= 0 || endChapter <=0 || startChapter > endChapter}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        선택 범위 읽기 시작
      </button>
    </div>
  );
};

export default ChapterSelector;