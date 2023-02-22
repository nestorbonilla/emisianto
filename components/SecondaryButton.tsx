import { ChevronRightIcon } from "@heroicons/react/24/solid";

export default function SecondaryButton({children, onClick}) {
  return (
    <button className="m-4" onClick={onClick}>
      <div className="flex flex-row font-medium">
        {children}
        <div className="bg-onyx w-6 h-6 rounded-full ml-2 hover:bg-prosperity">
          <ChevronRightIcon className="h-6 w-6 p-1 text-snow hover:text-onyx"/>
        </div>
      </div>
    </button>
  );
}