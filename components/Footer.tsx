import {AiFillGithub} from "react-icons/ai";

const navigation = [
  {
    name: "github",
    href: "https://github.com/isabellewei/emisianto"
  },
];

export default function Footer() {
  return (
    <footer className="bg-gypsum mt-auto border-black border-t">
      <div className="mx-auto max-w-7xl py-6 px-4 sm:px-6 md:flex md:items-center md:justify-between lg:px-8">
        <div className="flex justify-center space-x-6 md:order-2">
          {navigation.map((item) => (
            <a key={item.name} href={item.href} className="text-black hover:text-forest" target="_blank" rel="noopener noreferrer">
              <span className="sr-only">{item.name}</span>
              {item.name == "github" && <AiFillGithub className="h-6 w-6" aria-hidden="true" />}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
