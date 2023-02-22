export default function PrimaryButton({type, children, onClick = () => {}}) {
  if (type == "button") {
    return (
      <button
        type={type}
        className="inline-flex self-center items-center rounded-full border border-wood bg-prosperity py-2 px-5 my-5 text-md font-medium text-black hover:bg-snow"
        onClick={onClick}
      >
        {children}
      </button>
    );  
  } else if (type == "submit") {
    return (
      <button
        type={type}
        className="inline-flex self-center items-center rounded-full border border-wood bg-prosperity py-2 px-5 my-5 text-md font-medium text-black hover:bg-snow"
      >
        {children}
      </button>
    );  
  }
  
}